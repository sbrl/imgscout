"use strict";

import fs from "fs/promises";
import path from "path";

import { parse } from 'comment-json';

// HACK: Make sure __dirname is defined when using es6 modules. I forget where I found this - a PR with a source URL would be great!
const __dirname = import.meta.url.slice(7, import.meta.url.lastIndexOf("/"));

const filepath_defs = path.join(__dirname, `exif_tags.default.jsonc`);

// TODO support custom definition files here. We prob need an init() function and the appdata folder etc
const defs = parse(await fs.readFile(filepath_defs, `utf-8`));

// Ref <https://stackoverflow.com/a/77731548/1460422>
function to_snake_case(string) {
	return string.replace(/(([a-z])(?=[A-Z][a-zA-Z])|([A-Z])(?=[A-Z][a-z]))/g, '$1_').toLowerCase();
}

/**
 * Sorts, normalises, and applies exif/xmp/etc etc etc tags from a tags list from exiftool-vendored to a metadata index record.
 * 
 * Does NOT save the record - onlymutates it!
 * @param	{Tags}		exif	Output object from extract_exif()
 * @param	{[type]}	record	The record from the metadata index to update - see also MetaIndex.mjs
 * @return  {void}		Nothing 'cause we MUTATE record!
 */
export default function metadata_apply(exif, record) {
	const to_apply = new Map();
	for(const tag in defs.tags) {
		if(typeof exif[tag] !== "undefined")
			to_apply.set(tag, exif[tag]);
	}
	
	// Find a value in aliases
	for(const tag_source in defs.aliases) {
		if(to_apply.has(tag_source)) continue;
		for(const alias of defs.aliases[tag_source]) {
			if(typeof exif[alias] !== "undefined") {
				// Update the ORIGINAL tag name with the value of the alias tag
				to_apply.set(tag_source, exif[alias]);
				break;
			}
		}
	}
	
	for(const tag in defs.tags) {
		if(to_apply.has(tag_source)) continue;
		// Nah, still doesn't have a value. Set to default!
		to_apply.set(tag, defs.tags[tag]);
	}
	
	// Indescriminately update the record with the new values
	for(const [key, value] of to_apply) {
		record[to_snake_case(key)] = value;
	}
	
	// No need to return anything here, since we just mutated `record`
}