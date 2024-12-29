"use strict";

import njodb from 'njodb';

import log from '../core/NamespacedLog.mjs'; const l = log("metaindex");

/* Example record:
{
	id: int // global id
	filepath: string
	filepath_thumbnail: string
	mtime: string // date or Date, gets serialised to a string anyway // date file modified
	filesize: int
	
	// BELOW: EXIF-EXCLUSIVE TAGS, EXTRACTED WITH exiftool
	// Default values are indicated
	image_height: number=-1
	image_width: number=-1
}

********************************************************************

EXAMPLE RETURN VALUE FROM .select()

{
	lines: 3,
	selected: 3,
	ignored: 0,
	errors: [],
	blanks: 0,
	start: 1735407509939,
	end: 1735407509942,
	elapsed: 3,
	data: [
		{
			fruit: 'banana', count: 10
		},
		{
			fruit: 'apple', count: 3
		},
		{
			fruit: 'apple', count: 3
		}
	],
	details: [
		{
			store: '/tmp/x/y/data/data.2.json',
			lines: 1,
			selected: 1,
			ignored: 0,
			errors: [],
			blanks: 0,
			start: 1735407509939,
			end: 1735407509941,
			elapsed: 2
		},
		{
			store: '/tmp/x/y/data/data.3.json',
			lines: 2,
			selected: 2,
			ignored: 0,
			errors: [],
			blanks: 0,
			start: 1735407509940,
			end: 1735407509942,
			elapsed: 2
		}
	]
}

*/

/**
 * EXIF + metadata datastore.
 */
class MetaIndex {
	constructor(dirpath_db) {
		this.dirpath_db = dirpath_db;
		
		this.db = new njodb.Database(this.dirpath_db);
	}
	
	#check_errors(result) {
		l.debug(`#check_errors:result`, result);
		// Must not be any errors then
		if(!(result.errors instanceof Array)) return;
		// Might be errors if there's a list? Best check to be sure.
		if (result.errors.length > 0)
			throw new Error(`Error: Encountered error${result.errors.length > 1 ? `s` : ``} operating on the index: ${result.errors}`);
	}
	
	#normalise_record(record) {
		record.mtime = new Date(record.mtime);
	}
	
	/**
	 * Finds a record in the metadata database by the given file path.
	 * @param	{string}		filepath	The file path to search for.
	 * @returns	{object|null}	The found record, or null if not found.
	 */
	async find(filepath) {
		const result = await this.db.select(record => record.filepath == filepath);
		if(result.selected > 0)
			return this.#normalise_record(result.data[0]);
		return null;
	}
	
	async add_record(record) {
		return await this.add_records(record);
	}
	
	async add_records(...records) {
		l.log(`add_records: records`, records);
		const result = await this.db.insert(records);
		this.#check_errors(result);
		return result.inserted;
	}
	
	async update_record(record_target) {
		if(typeof record_target !== "object")
			throw new Error(`Error: Expected record_target to be of type object, but type ${typeof record_target} was passed instead.`);
		if(typeof record_target.id !== "number" || isNaN(record_target.id) || record_target.id < 0)
			throw new Error(`Error: record_target.id is not a valid number. Expected positive integer, but ${record_target.id} was passed instead.`);
		
		const result = await this.db.update(
			record => record.id == record_target.id,
			() => record_target // Replace record with record_target
		);
		
		this.#check_errors(result);
		return result.updated;
	}
	
	/**
	 * Deletes all records with any of the given ids.
	 * @param	{Array<number>}	ids	An array of record ids to delete.
	 * @return	{number}	The number of records deleted.
	 */
	async delete_by_id(...ids) {
		const result = await this.db.delete(
			record => ids.includes(record.id)
		);
		this.#check_errors(result);
		return result.deleted;
	}
	
	async get_all_filepaths() {
		const result = await this.db.select(
			() => true,
			record => { return {
				id: record.id,
				filepath: record.filepath,
				filepath_thumbnail: record.filepath_thumbnail
			}; }
		);
		this.#check_errors(result);
		return result.data;
	}
}

export default MetaIndex;