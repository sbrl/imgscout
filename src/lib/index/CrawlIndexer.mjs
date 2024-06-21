"use strict";

import os from "os";

import BetterQueue from "better-queue";

import walk_directories from "../io/walk_directories.mjs";

class CrawlIndexer {
	constructor(dirpaths_targets, app, concurrent_batch=1, concurrent_single="__CPU_COUNT__") {
		this.targets = dirpaths_targets;
		this.dirpath_data = dirpath_data;
		
		this.concurrent = {
			batched: concurrent_batch,
			single: this.#parse_concurrent_single(concurrent_single)
		};
		
		this.queue = new BetterQueue((batch, callback) => {
			// TODO process batch via CLIP here
			
			
			
		}, { concurrent: this.concurrent.batched });
	}
	
	#parse_concurrent_single(value) {
		if(typeof(value) === "string") {
			switch(value) {
				case "__CPU_COUNT__":
					return os.cpus().length;
				default:
					throw new Error(`Error: Unknown magic concurrency string ${value}.`);
			}
		}
		
		return value;
	}
	
	async crawl() {
		for await (let filepath of walk_directories(this.targets)) {
			// Do something
		}
	}
}

export default CrawlIndexer;