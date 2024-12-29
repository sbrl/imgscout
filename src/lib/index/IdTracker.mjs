"use strict";

import { readFileSync, writeFileSync } from 'fs';

/**
 * Manages the generation and filesystem-backed persistence of unique autoincrementing identifiers.
 * 
 * Warning: Any given persisted filepath for an id should be only accessed in a single thread. Accessing the same filepath from multiple threads will cause a race condition.
 * 
 * @class	IdTracker
 * @param	{string}	filepath	The file path where the identifier counter will be stored.
 */
class IdTracker {
	#save_timer = null;
	#last_save = null;
	
	constructor(filepath) {
		this.filepath = filepath;
		this.nextid = null;
		
		// Delay saves of IDs to disk by this many ms
		this.saveTimeout = 100;
		// If we haven't saved in this many seconds then clear the timer and force an immediate save
		this.saveTimeoutForce = 10000;
		
		// ---
		
	}
	
	
	/**
	 * Generates a new unique identifier.
	 * @returns	{number}	A new unique identifier.
	 */
	getid() {
		console.log(`DEBUG:IdTracker/getid START. nextid is `, this.nextid);
		if(this.nextid === null)
			this.#load();
		console.log(`DEBUG:IdTracker/getid nextid`, this.nextid);
		const id = this.nextid;
		this.nextid++;
		console.log(`DEBUG:IdTracker/getid id`, id, `nextid is now`, this.nextid);
		
		// Set and forget saving
		return id;
	}

	/**
	 * Generates an array of unique identifiers.
	 * @returns	{Array<number>}	A new unique identifier.
	 */
	getids(count) {
		if(this.nextid === null)
			this.#load();
		
		const ids = Array(count).fill(null).map(el => this.nextid++);
		this.#queue_save();
		return ids;
	}
	
	
	/**
	 * Resets the counter to 0 and persists the new value to the file system.
	 */
	reset() {
		this.nextid = 0;
		this.#save();
	}
	
	// -------------------------------------------------------------
	
	#queue_save() {
		// Force a save if we're over the limit
		if(new Date() - this.#last_save > this.saveTimeoutForce) {
			if (this.#save_timer !== null)
				clearTimeout(this.#save_timer);
			this.#save();
			this.#save_timer = null;
			this.#last_save = new Date();
		}
		
		// Clear any previous timer
		if (this.#save_timer !== null)
			clearTimeout(this.#save_timer);
		
		// Set a new save timer
		this.#save_timer = setTimeout(() => {
			this.#save();
			this.#save_timer = null;
			this.#last_save = new Date();
		}, this.saveTimeout)
	}
	
	#save() {
		writeFileSync(this.filepath, `${this.nextid}`);
	}
	
	#load() {
		let content = null;
		try {
			content = readFileSync(this.filepath, `utf-8`);
		}
		catch(error) {
			if(error.code == `ENOENT`) {
				this.nextid = 0;
				writeFileSync(this.filepath, `0`);
				content = 0;
			}
			else
				throw error;
		}
		finally {
			console.log(`DEBUG:IdTracker/load:finally content`, content);
			this.nextid = parseInt(content);
			console.log(`DEBUG:IdTracker/load:finally nextid is now`, this.nextid);
			
		}
	}
}

export default IdTracker;