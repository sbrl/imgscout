"use strict";

export default function(cli) {
	cli.subcommand("crawl", "DEBUG. Runs a manual crawl. WARNING: if imgscout is already running, then this may mean 2 crawls run at the same time, corrupting your indexes!")
		.argument("datadir", "Path to the directory storing the application data.", null, `string`);
}
