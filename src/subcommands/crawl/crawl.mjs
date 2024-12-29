"use strict";

import fs from 'fs';
import path from 'path';

import log from '../../lib/core/NamespacedLog.mjs'; const l = log("serve");

import settings from '../../settings.mjs';
import AppServer from '../../lib/AppServer.mjs';

// HACK: Make sure __dirname is defined when using es6 modules. I forget where I found this - a PR with a source URL would be great :D
const __dirname = import.meta.url.slice(7, import.meta.url.lastIndexOf("/"));

export default async function() {
	if(settings.datadir === null)
		throw new Error(`No data directory specified via the --datadir CLI arg.`);
	
	console.log(`(insert cool ansi art here when we know the name of this program)`);
	
	l.info(`SETTINGS`, settings);
	
	const app = new AppServer(settings.datadir);
	
	l.log(`DEBUG: STARTING CRAWL`);
	await app.crawler.crawl();
	
	// We don't exit here because the crawler queues are probably still full
	// We hang because of exiftool-vendored, and there's no good solution for when to tell exiftool-vendored to close down when we don't have a good way of restarting it again without restarting the entire process
}
