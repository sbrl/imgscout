"use strict";

import http from 'http';

import log from './core/NamespacedLog.mjs'; const l = log("app");

import routes from "./routes.mjs";

class AppServer {
	constructor() {
		this.router = routes(this);
	}
	
	async listen(port, bind_address = `::1`) {
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