"use strict";

import ServerRouter from 'powahroot/Server.mjs';

import middleware_log from './routes/middleware_log.mjs';
import middleware_catch_errors from './routes/middleware_errors.mjs';
import route_files from './routes/files_static.mjs';

import ui_index from './routes/ui_index.mjs';

export default function(app) {
	const router = new ServerRouter((typeof process.env.DEBUG_ROUTES) === "string");
	
	///
	// Middleware
	///
	router.on_all(middleware_catch_errors);
	router.on_all(middleware_log);
	
	///
	// UI routes
	///
	router.get(`/`, ui_index.bind(null, app));
	
	///
	// API routes
	///
	
	
	///
	// Static resources
	///
	router.get(`/static/::filename`, route_files);
	router.get("/health", (context, _next) => {
		context.send.plain(200, "OK");
	});
	
	
	return router;
}