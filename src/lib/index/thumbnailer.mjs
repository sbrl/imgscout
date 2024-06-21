"use strict";

import { Magick } from "magickwand.js";

export default async function make_thumbnail(filepath_source, filepath_target, thumbnail_size=`160x160`) {
	const img = new Magick.Image(filepath_source);
	
	await img.stripAsync();
	await img.thumbnailAsync(thumbnail_size);
	await img.writeAsync(filepath_target);
}