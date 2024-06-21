"use strict";

import { exiftool } from 'exiftool-vendored';

export default async function extract_exif(filepath) {
	const exif = await exiftool.read(filepath);
	
}