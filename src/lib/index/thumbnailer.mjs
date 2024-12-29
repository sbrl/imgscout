"use strict";

import { promisify } from 'util';
import { exec, execFile as execFileCB } from 'child_process';

import { lookpath } from 'lookpath';

import log from '../core/NamespacedLog.mjs'; const l = log("thumbnailer");

const execFile = promisify(execFileCB);

const bin_magick = await find_magick_bin(); // yay, this isn't C++!

l.log(`imagemagick binary is at ${bin_magick}`);

async function find_magick_bin() {
	return await lookpath(`magick`) ?? await lookpath(`convert`);
}


export default async function make_thumbnail(filepath_source, filepath_target, thumbnail_size = `160x160`) {
	if(filepath_source.startsWith(`-`))
		throw new Error(`Error: Unsafe filepath_source '${filepath_source}'. Reason: filepath starts with a -`);
	if(filepath_target.startsWith(`-`))
		throw new Error(`Error: Unsafe filepath_target '${filepath_target}'. Reason: filepath starts with a -`);
	
	const result = await execFile(bin_magick, [
		filepath_source
		`-all=`, // Remove all tags, ref https://stackoverflow.com/a/2654314/1460422
		`-auto-orient`,
		`-thumbnail`, thumbnail_size.replace(/[^0-9x]/g, ``),
		filepath_target
	]);
	
	l.log(`RESULT`, result); // TODO inspect this and do something withe.g. the exit code
	
	return true;
}
