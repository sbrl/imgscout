"use strict";

import fs from 'fs';
import path from 'path';

import { end_safe, write_safe } from '../io/StreamHelpers.mjs';
import { HNSW } from 'hnsw';
import nexline from 'nexline';
import gunzip from 'gunzip-maybe';
import { createGzip } from 'zlib';

class VectorIndex {
	constructor(filepath) {
		this.filepath = filepath;
		this.mode = path.extname(this.filepath.replace(/\.gz$/, "")).toLowerCase();

		this.data = null;
		this.index = null;
	}

	load(reindex = true) {
		const handle_raw = this.#open_read(this.filepath);
		const gunzip = gunzip();
		handle_raw.pipe(gunzip);
		const nl = nexline({
			input: gunzip
		});

		this.data = [];
		for (const line of nl) {
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

	query(vector, count) {
		return this.index.searchKNN(vector, count);
	}

	/**
	 * Appends items to the index.
	 * @param {...Object}	items	The items to save. Should be in the form { id: number, vector: Array<number> }
	 * @returns	void
	 */
	async add(...items) {
		const handle = this.#open_write(this.filepath, `a`); // WARNING: Won't work for compressed stuff! TODO handle this
		
		for (const item of items) {
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
	 * Also rebuilds the index afterwards, which is EXPENSIVE!
	 * Call this method as few times as possible!
	 * @param {...number} ids - The IDs of the items to remove.
	 * @returns {void}
	 */
	remove(...ids) {
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
	}

	reindex() {
		this.index = new HNSW();
		this.index.build(this.data);
	}

	async save() {
		const handle = this.#open_write(this.filepath);
		for (const item of this.data) {
			await write_safe(handle, this.#encode_item(item) + `\n`);
		}
		await end_safe(handle);
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
		const raw = fs.createReadStream(filepath, { flags });
		const gunzip = gunzip();
		raw.pipe(gunzip);
		return gunzip;
	}
}

export default VectorIndex;