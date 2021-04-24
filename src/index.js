const process = require('process');
const fs = require('fs');
const openpgp = require('openpgp');
const dbInit = require('./database.js');
const { token, login } = require('./client.js');
const { Revoker } = require('./revoker.js');
const { Stowaway } = require('./stowaway.js');
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

function readFile (path, encoding='utf8') {
	return new Promise((resolve, reject) => {
		fs.readFile(path, encoding, (err, data) => {
			if (err != null) {
				reject(err);
			}
			else {
				resolve(data);
			}
		});
	});
}

function writeFile (path, data, encoding='utf8') {
	return new Promise((resolve, reject) => {
		fs.writeFile(path, data, encoding, err => {
			if (err != null) {
				reject(err);
			}
			else {
				resolve();
			}
		});
	});
}

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
else if (process.argv.length > 2 && (process.argv[2] === '--token' || process.argv[2] === '-t')) {
	if (process.argv.length > 3) {
		token(process.argv[3], API_TOKEN)
		.then(() => { process.exit(0); })
		.catch(err => { console.error(`${err}`); process.exit(3); });
	}
	else {
		console.error('Error: Must pass in a discord token as the second argument!');
	}
}
else if (process.argv.length > 2 && process.argv[2] === '--revoke') {
	if (process.argv.length > 4) {
		const revocationPath = process.argv.length > 5 ? process.argv[5] : REVOCATION_CERTIFICATE;
		Promise.all([ readFile(PRIVATE_KEY), readFile(revocationPath) ])
		.then(values => {
			return {
				armoredKey: values[0],
				revocationCertificate: values[1]
			};
		})
		.then(async ({ armoredKey, revocationCertificate }) => {
			const key = await openpgp.readKey({ armoredKey });
			const nickname = process.argv[3];
			const { key: key1, revocationCertificate: rCert } = await openpgp.generateKey({
				type: 'ecc',
				curve: 'curve25519',
				userIds: [{ name: nickname }]
			});
			console.log('Genertaed new key! Always check that your key\'s nickname & fingerprint match on subsequent launches');
			console.log(`> key nickname: ${nickname}`);
			console.log(`> key fingerprint: ${key1.getFingerprint()}`);
			const client = await login(API_TOKEN);
			const stowaway = new Stowaway(dbInit(DATABASE), PRIVATE_KEY, VERSION);
			await stowaway.revokeKey(client, key, key1, revocationCertificate);
			console.log('old key revoked, saving new key!');
			// encrypt key1 with passphrase then write to PRIVATE_KEY
			const encryptedKey = await openpgp.encryptKey({
				key: key1,
				passphrase: process.argv[4]
			});
			await writeFile(encryptedKey.armor(), PRIVATE_KEY);
			await writeFile(rCert, revocationPath);
			console.log(`New revocation certificate saved to ${revocationPath}, move it to an offline storage device`);
			process.exit(0);
		})
		.catch(err => {
			console.log('revocation failed!');
			if (err != null) {
				console.error(err);
			}
			process.exit(4);
		});
	}
	else {
		console.log('Insufficient arguments for --revoke!');
		console.log('Must pass: --revoke <nickname> <passphrase> [revocation_path]');
		console.log('Pass --help to see usage information');
		process.exit(4);
	}
}
else if (process.argv.length > 2 && process.argv[2] === '--leave-server') {
	if (process.argv.length > 3) { // also check if process.argv[2] is an int
		login(API_TOKEN)
		.then(client => client.guilds.fetch(process.argv[3]))
		.then(guild => {
			console.log(`Leaving ${guild.name}...`);
			return guild.leave();
		})
		.then(() => { process.exit(0); })
		.catch(err => {
			console.error(err);
			process.exit(5);
		});
	}
	else {
		console.error('Error: Must pass in a server id as the second argument');
	}
}
else if (process.argv.length <= 2) {
	require('./main.js')(VERSION, BANNER, DATABASE, API_TOKEN, PRIVATE_KEY, REVOCATION_CERTIFICATE);
}
else {
	console.error(`Unrecognized command: ${process.argv.slice(2).join(' ')}`);
	process.exit(0);
}
