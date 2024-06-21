"use strict";

import { existsSync, promises as fs } from 'fs';
import http from 'http';
import path from 'path';

import njodb from 'njodb';

import log from './core/NamespacedLog.mjs'; const l = log("app");
import routes from "./routes.mjs";

async function mkdir(dirpath) {
	if(!existsSync(dirpath))
		await fs.mkdir(dirpath, { recursive: true });
}

class AppServer {
	constructor(dirpath_data) {
		this.dirpath_data = dirpath_data;
		this.dirpath_db_meta = path.join(this.dirpath_data, `db_meta`);
		
		
		this.router = routes(this);
	}
	
	async #init() {
		await mkdir(this.dirpath_data);
		await mkdir(this.dirpath_db_meta);
		
		this.db_meta = new njodb.Database(this.dirpath_db_meta);
	}
	
	async listen(port, bind_address = `::1`) {
		await this.#init();
		
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