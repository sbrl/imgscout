"use strict";

import os from 'os';
import { exiftool } from 'exiftool-vendored';

import log from '../core/NamespacedLog.mjs'; const l = log("extract_exif");

l.log(`exiftool is version ${await exiftool.version()}`);

// TODO figure out how to increase this. Ref https://github.com/photostructure/exiftool-vendored.js?tab=readme-ov-file#benchmarking it's ~ Math.max(1, Math.min(os.cpus.length/4)) by default
// exiftool.maxProcs = Math.max(1, os.cpus().length - 1);

export default async function extract_exif(filepath) {
	const exif = await exiftool.read(filepath);
	console.log(exif);
	// See also <https://photostructure.github.io/exiftool-vendored.js/interfaces/FileTags.html> for a list of tags that aren't exif tags but are instead metadata
	return exif;
}

// Test:
// console.log(JSON.stringify(await extract_exif(`/tmp/x/test.png`)));

/* Example output:
{
	SourceFile: '/tmp/x/test.png',
	errors: [],
	ExifToolVersion: 13,
	FileName: 'test.png',
	Directory: '/tmp/x',
	FileSize: '3.8 MB',
	FileModifyDate: ExifDateTime {
		year: 2024,
		month: 10,
		day: 29,
		hour: 20,
		minute: 45,
		second: 40,
		millisecond: undefined,
		tzoffsetMinutes: 0,
		rawValue: '2024:10:29 20:45:40+00:00',
		zoneName: 'UTC',
		inferredZone: false,
		zone: 'UTC'
	},
	FileAccessDate: ExifDateTime {
		year: 2024,
		month: 12,
		day: 27,
		hour: 15,
		minute: 29,
		second: 54,
		millisecond: undefined,
		tzoffsetMinutes: 0,
		rawValue: '2024:12:27 15:29:54+00:00',
		zoneName: 'UTC',
		inferredZone: false,
		zone: 'UTC'
	},
	FileInodeChangeDate: ExifDateTime {
		year: 2024,
		month: 12,
		day: 27,
		hour: 15,
		minute: 29,
		second: 59,
		millisecond: undefined,
		tzoffsetMinutes: 0,
		rawValue: '2024:12:27 15:29:59+00:00',
		zoneName: 'UTC',
		inferredZone: false,
		zone: 'UTC'
	},
	FilePermissions: '-rw-rw-r--',
	FileType: 'PNG',
	FileTypeExtension: 'png',
	MIMEType: 'image/png',
	ImageWidth: 1840,
	ImageHeight: 1036,
	BitDepth: 8,
	ColorType: 'RGB with Alpha',
	Compression: 'Deflate/Inflate',
	Filter: 'Adaptive',
	Interlace: 'Noninterlaced',
	ImageSize: '1840x1036',
	Megapixels: 1.9,
	warnings: []
}
*/