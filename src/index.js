const process = require('process');
const SAVE_DIR = './DO_NOT_SHARE/';
const DATABASE = SAVE_DIR + 'stowaway.db';
const API_TOKEN = SAVE_DIR + 'stowaway.token';
const PRIVATE_KEY = SAVE_DIR + 'stowaway.key';
const REVOCATION_CERTIFICATE = 'stowaway.revoke';

const VERSION = '1.0.0';
const BANNER = `      _  __ __        __        __
 //  /_\` / / / | | | /_/ | | | /_/ /_/  //
//  ._/ / /_/  |/|/ / /  |/|/ / /  /   //  v 1.0.0
This software is licensed under the WTFPL`;


if (process.argv.length > 2 && (process.argv[2] === '--channels' || process.argv[2] === '-c')) {
	require('./list-channels.js')(API_TOKEN);
}
else if (process.argv.length > 2 && (process.argv[2] === '--version' || process.argv[2] === '-v')) {
	console.log(VERSION);
}
else if (process.argv.length > 2 && (process.argv[2] === '--about' || process.argv[2] === '-a')) {
	console.log(require('./about.js')(BANNER));
}
else if (process.argv.length > 2 && (process.argv[2] === '--help' || process.argv[2] === '-h')) {
	require('./help.js')();
}
else if (process.argv.length > 2 && process.arg[2] === '--revoke') {
	if (process.argv.length > 3) {
		// process.arg[3] is the path to the revocation certificate
	}
	else {
		// revocation certificate path is REVOCATION_CERTIFICATE
	}
	console.log('todo'); // needs everything that Stowaway.revokeKey() needs
}
else if (process.argv.length > 2 && process.argv[2] === '--leave-server') {
	if (process.argv.length > 3) { // also check if process.argv[2] is an int
		console.log('todo'); // will require API_TOKEN & probably the database
	}
	else {
		console.log('must pass in a server id as a second argument');
	}
}
else {
	require('./main.js')(VERSION, BANNER, DATABASE, API_TOKEN, PRIVATE_KEY, REVOCATION_CERTIFICATE);
}
