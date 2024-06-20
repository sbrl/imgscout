"use strict";


export default function route_index(app, context, _next) {
	context.send.plain(200, `Hello, world!`);
}