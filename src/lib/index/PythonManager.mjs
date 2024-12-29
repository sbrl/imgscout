"use strict";

import child_process from 'child_process';
import path from 'path';
import crypto from 'crypto';

import nexline from 'nexline';

import log from '../core/NamespacedLog.mjs'; const l = log("pythonmanager");
const lpy = log("pythonworker");

import { write_safe } from '../io/StreamHelpers.mjs';

// HACK: Make sure __dirname is defined when using es6 modules. I forget where I found this - a PR with a source URL would be great!
const __dirname = import.meta.url.slice(7, import.meta.url.lastIndexOf("/"));


class PythonManager extends EventTarget {
	#reader_task = null;
	
	/**
	 * Manages a stdio-based Python process.
	 * 
	 * TODO Refactor this into an AbstractManager class and move clipify into a wrapper so we can support multiple communication protocols - e.g. TCP/IP etc
	 *
	 * @return  {PythonManager}
	 */
	constructor() {
		super();
		
		this.worker_path = path.join(__dirname, `py/worker.py`);
		
		// TODO don't just spawn it, manage it. Restart it if it crashes! Also have the ability to connect to the Python worker via multiple different options. stdio, http, unix socket, etc
		this.pychild = null;
		this.#spawn();
		
		this.respawn = true;
		
		this.active_jobs = new Map();
		this.ready = false;
	}
	
	/**
	 * Waits for the PythonManager to be ready to accept jobs.
	 * 
	 * @returns {Promise<void>} A promise that resolves when the PythonManager is ready, or rejects if an error occurs.
	 */
	wait_ready() {
		return new Promise((resolve, reject) => {
			if(this.ready) resolve();
			const handler = () => {
				this.removeEventListener(`error`, handler_error);
				this.removeEventListener(`ready`, handler);
				resolve();
			};
			const handler_error = (error) => {
				this.removeEventListener(`error`, handler_error);
				this.removeEventListener(`ready`, handler);
				reject(error);
			};
			this.addEventListener(`ready`, handler);
			this.addEventListener(`error`, handler_error);
		})
	}
	
	
	async clipify_image(filepaths) {
		const result = await this.do_job(`clipify-image`, {
			filepaths
		});
		// TODO log timing information etc here
		// TODO create a centralised CrawlIndexer logging feed that goes to a Server-Sent Events feed that everyone can connect to so they can see the status of the crawler. Perhaps this is a separate linker class or something? I dunno 'cause it's linking 2 very different areas of the app w/different lifetimes etc..... something to consider later.
		return result.vectors;
	}
	
	async clipify_text(text) {
		const result = await this.do_job(`clipify-text`, {
			text
		});
		// TODO log timing information etc here
		return result.vectors;
	}
	
	
	// ----------------------------------------------------------------------
	
	// Internal workings below - you probably want the functions above
	
	/**
	 * Executes a job in the Python worker process and returns the result.
	 *
	 * @param {string} event - The name of the job to execute.
	 * @param {object} data - The data to pass to the job.
	 * @returns {Promise<object>} - A promise that resolves with the result of the job.
	 */
	do_job(event, data) {
		return new Promise((resolve, reject) => {
			let msgid;
			do { msgid = crypto.randomUUID(); }
			while(this.active_jobs.has(msgid));
			
			this.active_jobs.set(msgid, true);
			
			this.send({
				event,
				msgid,
				data
			}).then(() => {
				const handler = ({ detail }) => {
					if(detail.msgid !== msgid) return;
					
					this.removeEventListener(event, handler);
					this.removeEventListener(`child-close`, handler_error);
					this.removeEventListener(`error`, handler_error);
					this.active_jobs.delete(msgid);
					
					resolve(detail);
				};
				const handler_error = (ev) => {
					// TODO consider retry scheme selectively depending on the error message
					this.removeEventListener(event, handler);
					this.removeEventListener(`child-close`, handler_error);
					this.removeEventListener(`error`, handler_error);
					
					l.error(`[do_job] Caught error`, ev);
					reject(ev);
				};
				
				this.addEventListener(event, handler);
				this.addEventListener(`child-close`, handler_error);
				this.addEventListener(`error`, handler_error);
			});
		});
	}
	
	/**
	 * Spawns a new Python child process and manages its lifecycle and event listeners.
	 *
	 * @returns {boolean} `true` if the child process was successfully spawned, `false` otherwise.
	 */
	#spawn() {
		if(this.pychild !== null) {
			l.warn(`Can't spawn another Python child process when the previous one hasn't yet exited`);
			return false;
		}
		
		this.pychild = child_process.spawn(this.worker_path, {
			stdio: [ "pipe", "pipe", "inherit" ]
		});
		
		this.pychild.on("spawn", async () => {
			this.dispatchEvent(`ready`, new CustomEvent());
			await this.send({
				event: `start`,
				data: {
					// Other options: RN50 RN101 RN50x4 RN50x16 RN50x64 ViT-B/32 ViT-B/16 ViT-L/14 ViT-L/14@336px
					// Ref https://github.com/openai/CLIP/blob/main/model-card.md#model-versions
					model_clip: `ViT-B/16`,
					device: `cpu`, // for now - we're aiming to run on low power devices. TODO quantise clip
				}
			});
		});
		this.pychild.on("close", () => {
			this.dispatchEvent(`child-close`, new CustomEvent());
			if(this.respawn) {
				this.#spawn();
			}
		})
		
		this.reader = nexline({
			input: this.pychild.stdout
		});
		
		
		this.#reader_task = this.#reader(); // Almost but not quite set-and-forget
		return true;
	}
	
	/**
	 * Sends an object to the Python child process by writing it to the child's stdin.
	 *
	 * @param {Object} obj - The object to send to the Python child process.
	 * @returns {Promise<void>} A Promise that resolves when the object has been written to the child's stdin.
	 */
	async send(obj) {
		await write_safe(
			this.pychild.stdin,
			`${JSON.stringify(obj)}\n`
		);
	}
	
	async #reader() {
		for await (let line of this.reader) {
			let obj = null;
			try {
				obj = JSON.parse(line);
			}
			catch(error) {
				l.error(`Caught error parsing message from Python: ${error}`);
				continue;
			}
			if(obj == null) continue; // Something weird happened

			if(typeof(obj.event) !== "string") {
				l.warn(`Invalid message '${line}' from Python doesn't have an event`);
				continue;
			}
			if(typeof(obj.data) === "undefined") {
				l.warn(`Invalid message '${line}' from Python doesn't have any data`);
				continue;
			}
			
			switch(obj.event) {
				case "log":
					lpy.log(obj.data);
					continue;
				case "info":
					lpy.info(obj.data);
					continue;
				case "warn":
					lpy.warn(obj.data);
					continue;
				case "error":
					lpy.error(obj.data);
					continue;
			}
			
			obj.data.msgid = obj.msgid;
			this.dispatchEvent(new CustomEvent(obj.event, {
				detail: obj.data
			}));
		}
	}
}

export default PythonManager;