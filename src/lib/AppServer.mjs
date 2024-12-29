"use strict";

import fs from 'fs';
import http from 'http';
import path from 'path';

import njodb from 'njodb';

import log from './core/NamespacedLog.mjs'; const l = log("app");
import routes from "./routes.mjs";
import CrawlIndexer from './index/CrawlIndexer.mjs';
import VectorIndex from './index/VectorIndex.mjs';
import IdTracker from './index/IdTracker.mjs';
import MetaIndex from './index/MetaIndex.mjs';

function mkdir(dirpath) {
	if(!fs.existsSync(dirpath))
		fs.mkdirSync(dirpath, { recursive: true });
}
function mkfile(filepath) {
	if(!fs.existsSync(filepath))
		fs.writeFileSync(filepath, ``);
}

class AppServer {
	constructor(dirpath_data) {
		/**
		 * The primary data directory.
		 * All application-specific data is stored in here.
		 * @var {string}
		 */
		this.dirpath_data = dirpath_data;
		/**
		 * The directory in which the thumbnails are stored.
		 * May contain nested directories.
		 * @var {[type]}
		 */
		this.dirpath_thumbnails = path.join(this.dirpath_data, `thumbnails`);
		/**
		 * Directory containing the metadata index, which is currently powered by njodb.
		 * @var {string}
		 */
		this.dirpath_db_meta = path.join(this.dirpath_data, `db_meta`);
		/**
		 * The filepath to the vector index.
		 * ....the vector index is a huge mess, so we probably need to rewrite it to scale better.
		 * @var {string}
		 */
		this.filepath_db_vector = path.join(this.dirpath_data, `vecindex.jsonl.gz`)
		/**
		 * The filepath the ID tracker will store the last ID it generated.
		 * @var {string}
		 */
		this.filepath_idtracker = path.join(this.dirpath_data, `nextid.txt`);
		/**
		 * Path to the ignore file.
		 * This file is formatted like a .gitignore file. The crawler will match against the .gitignore rules in this file to see which files it should skip/ignore/etc.
		 * @var {string}
		 */
		this.filepath_ignore = path.join(this.dirpath_data, `ignore`);
		
		
		mkdir(this.dirpath_data);
		mkdir(this.dirpath_db_meta);
		mkfile(this.filepath_ignore);
		
		// TODO app settings here
		
		// Module class instances for managing various things etc
		this.idtracker = new IdTracker(this.filepath_idtracker);
		this.crawler = new CrawlIndexer(
			`/tmp/x/test`,
			this
		);
		this.index_vector = new VectorIndex(path.join(this.dirpath_data, `vectordb.jsonl`));
		this.index_meta = new MetaIndex(this.dirpath_db_meta);
		
		// TODO init databases here
		// TODO create python child manager and put it here? see PythonManager for more information
		
		this.router = routes(this);
	}
	
	async listen(port, bind_address = `::1`) {
		await this.init();
		
		// ...please don't expose me directly. Use a reverse proxy!
		this.server = http.createServer((request, response) => {
			this.router.handle(request, response);
		});

		this.server.listen(port, bind_address, () => {
			const display_address = bind_address.includes(":") ? `[${bind_address}]` : bind_address;
			l.log(`Server listening on http://${display_address}:${port}`);
		});
		
	}
}

export default AppServer;