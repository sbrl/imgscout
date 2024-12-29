"use strict";

import jsSHA from 'jssha/sha3';
import path from 'path';
import fs from 'fs/promises'
import { existsSync } from 'fs';

// Hey you. Yes you! Go write a blog post :P

function make_hash(string) {
	const hash = new jsSHA(`SHA3-384`);
	hash.update(string);
	return hash.getHash(`HEX`);
}

/**
 * Creates a new static hashed and filepath nested within `depth` directories.
 * For example, `yay.a.jpeg` might become `3/4/8/3482fedc....aef_yay` with `depth=3` (the default).
 * Intermediate directories are created automatically, but the file is NOT created automatically as you probably want to add a file extension to it.
 * 
 * Example use case: a thumbnail cache.
 * 
 * @param	{string}	dirpath_root	The root directory for the whole setup.
 * @param	{string}	filepath_source	The filepath to hash & turn into the returned filepath.
 * @param	{number}	[depth=3]		The number of levels of nesting to implement.
 * @returns	{string}	The resulting filepath, sans-extension.
 */
export default async function get_hashed_filepath(dirpath_root, filepath_source, depth=3) {
	const hash = make_hash(filepath_source);
	// Get basename → remove all . extensions etc
	const filestem = path.basename(filepath_source).replace(/\..*$/, ``);
	
	const filename_target = `${hash}_${filestem}`;
	
	const subdirs = [];
	for(let i = 0; i < depth; i++) {
		subdirs.push(filename_target[i]);
	}
	
	const filepath_target = path.join(dirpath_root, ...subdirs, filename_target);
	
	// Create the dirpath if it exists
	const dirpath_target = path.dirname(filepath_target);
	if(!existsSync(dirpath_target))
		await fs.mkdir(dirpath_target, { recursive: true });
	
	return filepath_target;
}
