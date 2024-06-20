"use strict";

class ErrorWrapper extends Error {
	get code() {
		return this.inner_exception.code;
	}
	
	constructor(message, inner_exception) {
		super(message);
		this.inner_exception = inner_exception;
	}
	
	toString() {
		return `${super.toString()}\n***Inner Exception ***\n${this.inner_exception}`;
	}
}

export default ErrorWrapper;
