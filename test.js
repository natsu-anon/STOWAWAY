const process = require('process');
const openpgp = require('openpgp');
const { Client } = require('discord.js');
const { Stowaway } = require('./src/stowaway.js');
const Datastore = require('nedb');
const fs = require('fs');
const testArgs = require('./test-data.js');

const VERSION = '1.0.0-testing';

function clientLogin (tokenPath) {
	return new Promise((resolve, reject) => {
		fs.readFile(tokenPath, 'utf8', (err, data) => {
			if (err != null) {
				reject(err);
			}
			else {
				const client = new Client();
				client.once('ready', () => {
					resolve(client);
				});
				client.login(data);
			}
		});
	});
}

async function genKey () {
	return await openpgp.generateKey({
		type: 'ecc',
		curve: 'curve25519',
		userIds: [{
			name: 'stowaway'
		}]
	});
}

async function test() {
	// SETUP
	const { key: key0, revocationCertificate: rCert0 } = genKey();
	const { key: key1, revocationCertificate: rCert1 } = genKey();
	const client0 = clientLogin(testArgs.token0);
	const client1 = clientLogin(testArgs.token1);
	const stowaway0 = new Stowaway(new Datastore(), testArgs.key0, VERSION);
	const stowaway1 = new Stowaway(new Datastore(), testArgs.key1, VERSION);
	stowaway0.on('test', text => {
		console.log(`STOWAWAY0: ${text}`);
	});
	stowaway1.on('test', text => {
		console.log(`STOWAWAY0: ${text}`);
	});
	stowaway0.on('notify', (color, text) => {
		console.log(`\tnotify0: ${text}`);
	});
	stowaway1.on('notify', (color, text) => {
		console.log(`\tnotify1: ${text}`);
	});
	stowaway0.on('error', text => {
		console.error(`STOWAWAY0: ${text}`);
	});
	stowaway1.on('error', text => {
		console.error(`STOWAWAY1: ${text}`);
	});
	stowaway0.launch(client0, key0);
	stowaway1.launch(client1, key1);

	// TESTING


	// key revocation

	// CLEANUP
	client0.destroy();
	client1.destroy();
}

test();
