"use strict";

import settings from '../../settings.mjs';
import format_error from '../core/error.mjs';

import log from '../core/NamespacedLog.mjs';
const l = log("middleware:handle_errors");

/**
 * Handles errors thrown by handlers further down the chain. 
 * @param	{RequestContext}	context	The RequestContext object.
 * @param	{Function}			next	The function to call to invoke the next middleware item
 */
async function middleware_catch_errors(context, next) {
	try {
		await next();
	} catch(error) {
		await handle_error(error, context);
	}
}

/**
 * Handles a given error thrown by a given RequestContext.
 * @param  {Error} error   The error that was thrown.
 * @param  {RequestContext} context The RequestContext from which the error was thrown.
 */
async function handle_error(error, context) {
	l.log(`[${new Date().toLocaleString()}] [${context.request.method} 503] ${context.request.connection.remoteAddress} -> ${context.request.url}`);
	l.error(format_error(error, settings.verbose)); // TODO: colourise this?
	// TODO: Send a better error page - perhaps with an error id that's uploaded somewhere?
	
	try {
		const production = (process.env["NODE_ENV"] ?? "production") === "production";
		const msg_nice = "Oops! An error occurred. Please report this to your system administrator, noting the exact time this happened and the IP address of the requesting server.\n";
		const msg_full = `*** Server Error ***\n${error}\n`;
		// if(context.env.sse instanceof ServerSentEventsStream) {
		// 	await context.env.sse.emit(`error`, production ? msg_nice : msg_full);
		// 	await context.env.sse.end();
		// }
		// else {
			context.send.plain(503, production ? msg_nice : msg_full);
		// }
		
	}
	catch(error) {
		l.error(`Error: Caught error while sending response to client: ${format_error(error, settings.verbose)}`);
	}
}

export default middleware_catch_errors;
