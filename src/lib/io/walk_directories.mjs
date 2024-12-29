"use strict";

import { promises as fs, readdir } from 'fs';
import path from 'path';

const readdir_opts = { withFileTypes: true, encoding: 'utf8' };

export default async function walk_directories(dirpaths, filter_fn=null) {
	const stack = (await Promise.all(
		dirpaths.map(async dirpath => await fs.readdir(dirpath, readdir_opts))
	)).flat(Infinity);
	
	// First function returns stack length whenever you like, 2nd is the real generator
	return [() => stack.length, async function*() {
		do {
			const next = stack.pop();
			console.log(`[walker] NEXT`, next);
			const filepath_abs = path.join(next.parentPath, next.name);

			if (next.isDirectory()) { // If it's a directory....
				// Add all items in the dir to the stack
				stack.push(...(await fs.readdir(
					filepath_abs,
					readdir_opts
				)));
				continue;
			}

			// Nope, it's a file

			// If we have a filter function, then check against it
			// If filter_fn returns true, then keep we keep the filepath
			// if filter_fn returns false, we skip it
			if (filter_fn !== null && !filter_fn(filepath_abs)) continue;

			yield filepath_abs;
		} while (stack.length > 0);
	}]
	
}