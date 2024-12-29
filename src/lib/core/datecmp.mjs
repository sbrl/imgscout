"use strict";

export default function datecmp(a, b) {
	console.log(`DEBUG:datecmp a`, a, `b`, b);
	const a_is = a instanceof Date;
	const b_is = b instanceof Date;
	if(!(a_is && b_is)) return a == b;
	
	if(!a_is || !b_is) return false;
	
	return a.toISOString() == b.toISOString();
}