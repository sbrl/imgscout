"use strict";

import path from 'path';
import fs from 'fs';

import mime from 'mime';

const __dirname = import.meta.url.slice(7, import.meta.url.lastIndexOf("/"));

function make_path_safe(path) {
	return path.replace(/[^a-zA-Z0-9\-\._\/]/g, "")
		.replace(/\.+/g, ".");
}

async function route_files(context) {
	let safe_url = make_path_safe(context.request.url.replace(/^\/static\//, ""));
	let file_path = path.join(path.resolve(__dirname, "../../../dist_client"), safe_url.replace(/\.{2,}/, ""));
	try {
		let info = await fs.promises.stat(file_path);
		if(info && info.isFile()) {
			context.response.writeHead(200, {
				"content-type": mime.getType(file_path),
				"content-length": info.size
			});
			fs.createReadStream(file_path)
				.pipe(context.response);
		}
		else {
			send_404(context, safe_url);
			return;
		}
	} catch(error) {
		if(error.code == "ENOENT") {
			send_404(context, safe_url);
			return;
		}
		else {
			throw error;
		}
	}
}

function send_404(context, url) {
	context.send.plain(404, `Error: ${url} couldn't be found.\n`);
}

export { route_files };
export default route_files;
