"use strict";

import { promises as fs } from 'fs';

/**
 * Manages the generation and filesystem-backed persistence of unique autoincrementing identifiers.
 * 
 * Warning: Any given persisted filepath for an id should be only accessed in a single thread. Accessing the same filepath from multiple threads will cause a race condition.
 * 
 * @class	IdTracker
 * @param	{string}	filepath	The file path where the identifier counter will be stored.
 */
class IdTracker {
	constructor(filepath) {
		this.filepath = filepath;
		this.nextid = null;
	}
	
	
	/**
	 * Generates a new unique identifier.
	 * @returns	{number}	A new unique identifier.
	 */
	async getid() {
		if(this.nextid === null)
			await this.#load();
		const id = this.nextid++;
		await this.#save();
		return id;
	}

	/**
	 * Generates an array of unique identifiers.
	 * @returns	{Array<number>}	A new unique identifier.
	 */
	async getids(count) {
		if(this.nextid === null)
			await this.#load();
		
		const ids = Array(count).fill(null).map(el => this.nextid++);
		await this.#save();
		return ids;
	}
	
	
	/**
	 * Resets the counter to 0 and persists the new value to the file system.
	 */
	async reset() {
		this.nextid = 0;
		await this.#save();
	}
	
	// -------------------------------------------------------------
	
	async #save() {
		await fs.writeFile(this.filepath, `${this.nextid}`);
	}
	
	async #load() {{
		let content = null;
		try {
			content = await fs.readFile(this.filepath, `utf-8`);
		}
		catch(error) {
			if(error.code == `ENOENT`) {
				this.nextid = 0;
				await fs.writeFile(this.filepath, `0`);
				content = 0;
			}
			else
				throw error;
		}
		finally {
			this.nextid = parseInt(content);
		}
	}}
}

export default IdTracker;