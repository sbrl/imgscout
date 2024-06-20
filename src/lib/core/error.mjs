"use strict";

import ErrorWrapper from "./ErrorWrapper.mjs";

export default function(error, verbose) {
	if(error instanceof ErrorWrapper) return error.toString();
	
	if(verbose)
		return error.stack;
	else return error.toString();
}
