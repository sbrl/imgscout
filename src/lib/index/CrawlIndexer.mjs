"use strict";

import os from "os";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";

import BetterQueue from "better-queue";
import p_map from "p-map";
import ignore from "ignore";

import log from '../core/NamespacedLog.mjs'; const l = log("crawlindexer");
import walk_directories from "../io/walk_directories.mjs";
import PythonManager from "./PythonManager.mjs";
import extract_exif from "./extract_exif.mjs";
import metadata_apply from "./metadata_apply.mjs";
import get_hashed_filepath from "../io/get_hashed_filepath.mjs";
import make_thumbnail from "./thumbnailer.mjs";
import datecmp from "../core/datecmp.mjs";

class CrawlIndexer {
	#has_init = false;
	#ignore = null;
	#__bound_do_item = null;
	
	constructor(dirpaths_targets, app, concurrent_batch = 1, concurrent_single = "__CPU_COUNT__", batch_size = 64) {
		this.app = app;
		
		this.targets = dirpaths_targets;
		if(typeof(this.targets) == `string`)
			this.targets = [ this.targets ];
		
		this.pythonmanager = new PythonManager();

		this.concurrent = {
			batched: concurrent_batch,
			single: this.#parse_concurrent_single(concurrent_single)
		};
		
		this.queue_preprocess = new BetterQueue((filepath, callback) => {
			// l.log(`DEBUG:queue_preprocess FILEPATH`, filepath);
			this.#preprocess_item(filepath).then(callback);
			
		}, { concurrent: this.concurrent.single });
		this.queue_preprocess.resume();
		this.queue_main = new BetterQueue((batch, callback) => {
			// TODO process batch via CLIP here
			
			this.#do_batch(batch).then(callback);
			
			// TODO monitor concurrency of exif indexing, thumbnailing and return early if dropping off

		}, {
			concurrent: this.concurrent.batched,
			batchSize: batch_size,
			batchDelayTimeout: 3 * 1000 // wait at most 3 seconds for new tasks to be added to the queue before running a batch to try & make sure batches are full. If we can do a full batch immediately without waiting, then we will do so
		});
		this.queue_main.resume();
		this.crawl_i = null;
		
		this.#__bound_do_item = this.#do_item.bind(this);
	}
	
	async #init() {
		if(this.#has_init) return;
		
		let rules_ignore = [];
		if (existsSync(this.app.filepath_ignore))
			rules_ignore = (await fs.readFile(this.app.filepath_ignore, `utf-8`))
				.split(`\n`)
				.map(line => line.trim());
		
		this.#ignore = ignore().add(rules_ignore);
		
		this.#has_init = true;
	}
	
	async #preprocess_item(filepath) {
		l.log(`preprocess`, filepath);
		
		// We're concurrent here
		let record = await this.app.index_meta.find(filepath);
		let record_is_new = false;
		if(record == null) { // We'll pull a new one out of thin air if we have to!
			record_is_new = true;
			record = {
				id: this.app.idtracker.getid(),
				filepath,
			};
		}
		
		// Okay, there's a record in the index. But is it up to date?
		const stats = await fs.stat(filepath);
		
		// If mtime & filesize matches, then nah, don't bother
		if (datecmp(stats.mtime, record.mtime) && stats.size == record.filesize) {
			l.info(`Record for ${filepath} is up to date, ${stats.size}=${record.filesize} &&`,stats.mtime,`=`,record.mtime,`, ref`, record);
			return;
		}
		
		l.info(`Record for ${filepath} is NOT up to date, ${stats.size}≠${record.filesize} →`, stats.size == record.filesize, `&&`, stats.mtime, `≠`, record.mtime, `→`, datecmp(stats.mtime,record.mtime),`, ref`, record);
		
		record.mtime = stats.mtime;
		record.filesize = stats.size;
		
		// WARNING: record hasn't been saved yet! That comes later after the exif update.
		
		// Send it to the main queue o/
		l.info(`📥 QUEUE:main`, filepath);
		this.queue_main.push({
			id: record.id,
			filepath,
			record,
			record_is_new
		});
	}
	
	
	async #do_batch(items) {
		l.info(`process BATCH`, items);
		
		const vectors = await this.pythonmanager.clipify_image(items.map(item => item.filepath));
		
		// Add vectors to item TASK as it goes through the pipeline
		for(const i in vectors) {
			items[i].vector = vectors[i];
		}
		
		// TODO optimise this...! It's SO expensive >_<
		// ............even with the timeout to ensure we don't rebuild the vector index on every batch that comes through
		this.app.index_vector.remove(...items.map(item => item.id));
		this.app.index_vector.add(...items);
		await this.app.index_vector.save();
		
		await p_map(items, this.#__bound_do_item.bind(this), { stopOnError: false, concurrency: os.cpus().length });
	}
	
	async #do_item(item) {
		// We're already parallel ref above - no need to run steps here in parallel too
		// record ALWAYS exists
		
		const exif = await extract_exif(item.filepath);
		
		metadata_apply(exif, item.record);
		
		// Only set the thumbnail filepath if it doesn't already exist
		// This way even if we change the hashed filepath algorithm later, it shouldn't affect existing thumbnails
		if(typeof item.record.filepath_thumbnail !== "string")
			item.record.filepath_thumbnail = await get_hashed_filepath(
				this.app.dirpath_thumbnails,
				item.filepath
			) + `.jpg`;
		
		// Regenerate the thumbnail
		await make_thumbnail(item.filepath, item.record.filepath_thumbnail);
		
		// Send the (new or updated) record to the metadata index
		if(item.record_is_new) {
			await this.app.index_meta.add_record(item.record);
			l.log(`ADD ${item.filepath}`);
		}
		else {
			await this.app.index_meta.update_record(item.record);
			l.log(`UPDATE ${item.filepath}`);
		}
		l.log(`>> record:`, item.record, `record_is_new`, item.record_is_new);
	}

	/**
	 * Parses the value for the single-threaded concurrency setting.
	 * If the value is a string, it checks for the special value "__CPU_COUNT__"
	 * and returns the number of CPU cores. Otherwise, it throws an error.
	 * If the value is not a string, it simply returns the value.
	 *
	 * @param {string|number} value - The value to parse for the single-threaded concurrency setting.
	 * @returns {number} - The parsed concurrency value.
	 * @throws {Error} - If the value is a string but not "__CPU_COUNT__".
	 */
	#parse_concurrent_single(value) {
		if (typeof (value) === "string") {
			switch (value) {
				case "__CPU_COUNT__":
					return os.cpus().length;
				default:
					throw new Error(`Error: Unknown magic concurrency string ${value}.`);
			}
		}
		
		return value;
	}
	
	/**
	 * Checks all files registered in the system to make sure they still exist.
	 * Any files that *don't* still exist are removed from the internal indexes.
	 * This includes the metadata index, the vector index, and the generated thumbnail.
	 * WARNING: This function is both memory and time intensive!
	 * .....here's hoping that njodb adds a streaming iterator in the future we can use to iterate over all entries in the index.
	 */
	async check_for_deleted() {
		const to_delete = [];
		
		for (const { id, filepath, filepath_thumbnail } of await this.app.index_meta.get_all_filepaths()) {
			if(existsSync(filepath))
				continue;
			
			// Queue exif+vector index record for deletion
			to_delete.push(id);
			// If the file doesn't exist, delete the thumbnail
			await fs.rm(filepath_thumbnail);
		}
		
		// Delete from the indexes
		await Promise.all([
			this.app.index_meta.delete_by_id(...to_delete),
			this.app.index_vector.remove(...to_delete)
		]);
		
		return to_delete.length;
	}
	
	/**
	 * The ignore package apparently hates absolute paths, so this function makes an absolute path relative.
	 * Basically filepath → make relative → prepend basename(target).
	 * Picks the first target found that matches the beginning of the filepath.
	 * @param	{string}	filepath	The filepath to make relative.
	 * @returns	{string}	The relativified filepath.
	 */
	#make_filepath_relative(filepath) {
		for(const target of this.targets) {
			if(target.substring(0, target.length) == target) {
				const result = target.substring(target.length);
				// Return the dirname of target + the relative path for filtering based on which target dir in case of multiple dirs
				return path.join(path.basename(target), result);
			}
		}
		return filepath;
	}
	
	/**
	 * Filter function for passing to walk_directories()
	 * @param	{string}	filepath	The filepath to filter on.
	 * @returns	{boolean}	Whether we want to keep it or not. Returning `true` means we wanna keep the filepath. Returning `false` means we wanna skip the filepath.
	 */
	#filter_filepath(filepath) {
		// If .ignores() is true, then we invert to false which means we skip the file.
		// if .ignores() is false, then we invert to true which means we keep it.
		return !this.#ignore.ignores(this.#make_filepath_relative(filepath));
	}
	
	async crawl() {
		l.log(`crawl started at ${new Date().toISOString()}`)
		await this.#init();
		
		if(this.crawl_i !== null) {
			l.warn(`Can't start a new crawl before the last one has finished`);
		}
		this.crawl_i = 0;
		
		const [get_stack_length, walker] = await walk_directories(this.targets, this.#filter_filepath.bind(this));
		
		for await (let filepath of walker()) {
			l.info(`walker: ${filepath} // stack length ${get_stack_length()}`);
			// TODO implement ignore system here
			
			// TODO IF THE QUEUE IS TOO FULL, WAIT FOR IT TO CALM DOWN A BIT HERE
			
			this.queue_preprocess.push(filepath);
			// See also https://www.npmjs.com/package/better-queue#updating-task-status
			// There's a built-in progress indicator
			
			this.crawl_i++;
			
			// TODO implement proper logging system for goodness sake
		}
		
		// TODO send SSE message here to keep everyone up to date ref status, see one of the comments around here somewhere ref the plan for that.... I forget where.
		
		await this.check_for_deleted();
		this.crawl_i = null;
		
		l.log(`crawl complete, but queues will have items remaining`);
	}
	
	get_crawl_status() {
		switch(this.crawl_i) {
			case null:
				return { state: "idle" };
			default:
				// TODO update this with more stats etc
				return {
					state: "active",		// We're crawling rn
					walker: this.crawl_i,	// The walker has walked this many items (but these haven't necessarily been indexed yet). Doesn't include ignored items
					// TODO add more visibility into the system here, incl. performance metrics etc
				};
		}
	}
}

export default CrawlIndexer;