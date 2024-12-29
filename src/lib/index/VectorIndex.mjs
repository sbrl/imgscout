"use strict";

import fs, { existsSync } from 'fs';
import path from 'path';
import { createGunzip, createGzip } from 'zlib';

import { HNSW } from 'hnsw';
import nexline from 'nexline';
// import gunzip from 'gunzip-maybe'; //  nexline doesn't like it anymore :-(

import log from '../core/NamespacedLog.mjs'; const l = log("vectorindex");
import { end_safe, write_safe } from '../io/StreamHelpers.mjs';

class VectorIndex {
	#last_rebuild = null;
	#last_save = null;
	
	/**
	 * Creates a new `VectorIndex` instance.
	 *
	 * @param	{string}	filepath	The path to the file to store the database in. Must be .jsonl, but may optionally have .gz on the end (recommended).
	 * @param	{number}	[min_ms=0]	The maximum interval at which to rebuild the index and save it to disk. In other words, the minimum time that must pass before a rebuild + resave is allowed. Set to 0 to disable.
	 *
	 * @return	{VectorIndex}	A new VectorIndex.
	 */
	constructor(filepath, min_ms = 0) {
		this.filepath = filepath;
		// WARNING: Note we remove compression file name extensions here!! When adding support for another format, it also needs updating here too....!
		this.mode = path.extname(this.filepath.replace(/\.gz$/, "")).toLowerCase().replace(/^\.+/, ``);

		this.data = null;
		this.index = null;
		
		/**
		 * Maximum interval at which the index should be rebuilt.
		 * @var {number}
		 */
		this.min_ms_reindex = min_ms;
		/**
		 * Maximum interval at which to save the index to disk.
		 * 
		 * @var {number}
		 */
		this.min_ms_save = min_ms;
	}

	async load(reindex = true) {
		this.data = [];
		if(!existsSync(this.filepath))
			await fs.promises.writeFile(this.filepath, ``);
		
		const handle = this.#open_read(this.filepath);
		const nl = nexline({
			input: handle
		});

		for await (const line of nl) {
			if(line.trim().length === 0)
				continue;
			
			let parsed;
			switch (this.mode) {
				case "jsonl":
					parsed = JSON.parse(line);
					break;
				case "csv":
					parsed = line.trim().split(`\t`);
					parsed = { id: parsed[0], vector: parsed.slice(1) };
					break;
			}
			this.data.push(parsed);
		}

		if (reindex) this.reindex();
	}
	
	async load_if_null(reindex = true) {
		if(this.data === null)
			await this.load(reindex);
	}

	query(vector, count) {
		if(this.data === null)
			throw new Error(`VectorIndex not ready. Call and await this.load_if_null() first!`);
		
		return this.index.searchKNN(vector, count);
	}

	/**
	 * Appends items to the index.
	 * @param {...Object}	items	The items to save. Should be in the form `{ id: number, vector: Array<number> }`. Any additional properties are ignored.
	 * @returns	void
	 */
	async add(...items) {
		await this.load_if_null();
		
		const handle = this.#open_write(this.filepath, `a`); // WARNING: Won't work for compressed stuff! TODO handle this
		
		for (const item of items) {
			l.info(`add: item`, item);
			if (typeof item.id != "number") throw new Error(`Invalid item id`);
			if (!(item.vector instanceof Array)) throw new Error(`Invalid item vector`);
			await write_safe(handle, this.#encode_item(item) + `\n`);
			this.data.push(item);
			this.index.addPoint(item.id, item.vector); // TODO handle our end as Float32Array
		}
		await end_safe(handle);
	}


	/**
	 * Removes the specified item IDs from the index.
	 * Calls reindex() internally - which is EXPENSIVE!
	 * Call this method as few times as possible!
	 * @param {...number} ids - The IDs of the items to remove.
	 * @returns {void}
	 */
	async remove(...ids) {
		await this.load_if_null();
		
		const toremove = [];
		for (const id of ids) {
			for (const i in this.items) {
				if (this.items[i].id == id) {
					toremove.push(i);
					break;
				}
			}
		}

		toremove.sort().reverse();
		for (const index of toremove) {
			this.data.splice(index, 1);
		}
		
		this.reindex();
	}
	
	
	/**
	 * Rebuilds the index from the stored data.
	 * WARNING: This operation is expensive! Call it as few times as possible!
	 * Change `this.min_mx_reindex` to change the frequency at which this method is called internally.
	 * @returns {boolean} `true` if the index was rebuilt, `false` if the rebuild was skipped due to being called to quickly, ref `this.min_ms_reindex`.
	 */
	reindex() {
		if(this.min_ms_reindex > 0 && this.#last_rebuild !== null && new Date() - this.#last_rebuild < this.min_ms_reindex)
			return false;
		
		l.debug(`reindex: this.data`, this.data);
		
		this.index = new HNSW();
		this.index.buildIndex(this.data);
		
		this.#last_rebuild = new Date();
		return true;
	}

	async save() {
		if(this.min_ms_reindex > 0 && this.#last_save !== null && new Date() - this.#last_save < this.min_ms_save)
			return false;
		
		const handle = this.#open_write(this.filepath);
		for (const item of this.data) {
			await write_safe(handle, this.#encode_item(item) + `\n`);
		}
		await end_safe(handle);
		return true;
	}

	#encode_item(item) {
		switch (this.mode) {
			case "jsonl":
				return JSON.stringify(item);
			case "csv":
				return [item.id, ...item.vector].join(`\t`);
			default:
				throw new Error(`Error: Unknown item encoding mode '${this.mode}', taken from filename extension. Possible options: jsonl, csv`);
		}
	}

	#open_write(filepath, flags=`w`) {
		const raw = fs.createWriteStream(filepath, { flags });
		const extname = path.extname(filepath).toLowerCase();
		switch(extname) {
			case `gz`:
				const gz = createGzip();
				raw.pipe(gz);
				return gz;
			// TODO support more compression schemes here
			default:
				return raw;
		}
	}
	
	#open_read(filepath, flags=`r`) {
		let handle = fs.createReadStream(filepath, { flags });
		if(filepath.endsWith(`.gz`)) {
			const gz = createGunzip();
			handle.pipe(gz);
			handle = gz;
		}
		return handle;
	}
}

export default VectorIndex;