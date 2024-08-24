"use strict";

import os from "os";

import BetterQueue from "better-queue";
import p_map from "p-map";

import log from './lib/core/NamespacedLog.mjs'; const l = log("crawlindexer");
import walk_directories from "../io/walk_directories.mjs";
import PythonManager from "./PythonManager.mjs";

class CrawlIndexer {
	constructor(dirpaths_targets, app, concurrent_batch = 1, concurrent_single = "__CPU_COUNT__") {
		this.app = app;
		
		this.targets = dirpaths_targets;
		this.dirpath_data = dirpath_data;
		
		this.pythonmanager = new PythonManager();

		this.concurrent = {
			batched: concurrent_batch,
			single: this.#parse_concurrent_single(concurrent_single)
		};

		this.queue = new BetterQueue((batch, callback) => {
			// TODO process batch via CLIP here
			
			this.#do_batch(batch).then(callback);
			
			// TODO monitor concurrency of exif indexing, thumbnailing and return early if dropping off

		}, { concurrent: this.concurrent.batched });
		this.crawl_i = null;
	}
	
	
	async #do_batch(filepaths) {
		const vectors = await this.pythonmanager.clipify_image(filepaths);
		l.log(`DEBUG RESULT vectors`, vectors);
		const ids = this.app.idtracker.getids(vectors.length);
		const items = [];
		for(const i in vectors) {
			items.push({
				id: ids[i],
				vector: vectors[i]
			});
		}
		this.app.index_vector.add(items);
		
		await p_map(items, async (item) => {
			// TODO fetch & index exif data here
		}, { stopOnError: false, concurrency: os.cpus() });
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
	
	async crawl() {
		if(this.crawl_i !== null) {
			l.warn(`Can't start a new crawl before the last one has finished`);
		}
		this.crawl_i = 0;;
		for await (let filepath of walk_directories(this.targets)) {
			this.queue.push(filepath);
			// See also https://www.npmjs.com/package/better-queue#updating-task-status
			// There's a built-in progress indicator
			
			i++;
		}
	}
	
	get_crawl_status() {
		switch(this.crawl_i) {
			case null:
				return { state: "idle" };
			default:
				return {
					state: "active",		// We're crawling rn
					walker: this.crawl_i,	// The walker has walked this manny items (but these haven't necessarily been indexed yet)
					// TODO add more visibility into the system here, incl. performance metrics etc
				};
		}
	}
}

export default CrawlIndexer;