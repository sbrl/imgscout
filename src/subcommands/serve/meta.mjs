"use strict";

export default function(cli) {
	cli.subcommand("serve", "Starts the http server")
		.argument("port", "Specifies the port number to listen on.", 3485, "integer")
		.argument("bind", "Specifies the address to bind on - defaults to ::1, which on most linux systems should listen on both IPv6 and IPv4.", "::1", "string");
}
