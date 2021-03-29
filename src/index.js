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
	require('./about.js')(BANNER);
}
else if (process.argv.length > 2 && (process.argv[2] === '--help' || process.argv[2] === '-h')) {
	require('./help.js')();
}
else if (process.argv.length > 2 && process.arg[2] === '--revoke') {
	console.log('todo');
}
else {
	require('./main.js')(VERSION, BANNER, DATABASE, API_TOKEN, PRIVATE_KEY, REVOCATION_CERTIFICATE);
}
