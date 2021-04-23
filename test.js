const process = require('process');
const openpgp = require('openpgp');
const { Client } = require('discord.js');
const { Stowaway } = require('./src/stowaway.js');
const Datastore = require('nedb');
const fs = require('fs');
const { token0, token1, keyPath0, keyPath1 , channels0, channels1} = require('./test-data.js');

function sleep (seconds) {
	return new Promise(resolve => { setTimeout(resolve, 1000 * seconds); });
}

function clientLogin (tokenPath) {
	return new Promise((resolve, reject) => {
		fs.readFile(tokenPath, 'utf8', (err, data) => {
			if (err != null) {
				reject(err);
			}
			else {
				const client = new Client();
				client.once('ready', () => {
					client.user.setStatus('dnd')
					.then(() => { 
						resolve(client);
					});
				});
				client.login(data)
				.catch(err => {
					reject(err);
				});
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
	const VERSION = '1.0.0-testing';
	try {

		// SETUP

		const { key: key0, revocationCertificate: rCert0 } = await genKey();
		const { key: key1, revocationCertificate: rCert1 } = await genKey();
		const client0 = await clientLogin(token0);
		const client1 = await clientLogin(token1);
		const stowaway0 = new Stowaway(new Datastore(), keyPath0, VERSION);
		const stowaway1 = new Stowaway(new Datastore(), keyPath1, VERSION);
		console.log('TESTING BEGIN!');
		stowaway0.on('test', text => {
			console.log(`${client0.user.tag}: ${text}`);
		});
		stowaway1.on('test', text => {
			console.log(`${client1.user.tag}: ${text}`);
		});
		stowaway0.on('notify', (color, text) => {
			console.log(`\t${client0.user.tag} ${color}: ${text}`);
		});
		stowaway1.on('notify', (color, text) => {
			console.log(`\t${client1.user.tag} ${color}: ${text}`);
		});
		stowaway0.on('error', text => {
			console.error(`${client0.user.tag}: ${text}`);
		});
		stowaway1.on('error', text => {
			console.error(`${client1.user.tag}: ${text}`);
		});
		stowaway0.launch(client0, key0);
		stowaway1.launch(client1, key1);


		// TESTING


		// handshakes
		console.log('Handshaking...');
		for (let i = 0; i < channels0.length; i++) {
			await stowaway0.loadChannel(await client0.channels.fetch(channels0[i]));
		}
		for (let i = 0; i < channels1.length; i++) {
			await stowaway1.loadChannel(await client1.channels.fetch(channels1[i]));
		}

		// public message
		let channel0  = await client0.channels.fetch(channels0[0]); // unfortunately, you have to do this
		let channel1  = await client1.channels.fetch(channels1[0]);
		await stowaway0.loadChannel(channel0);
		await stowaway1.loadChannel(channel1);
		await stowaway0.messagePublic(channel0, 'AHOY');
		await stowaway1.messagePublic(channel1, 'AHOYO');
		await stowaway0.messageSigned(channel0, 'LOREM IPSUM');
		await stowaway1.messageSigned(channel1, 'CARTAGO DELENDA EST');

		// key signing
		await new Promise(async resolve => {
			await stowaway1.signKey(channel1, stowaway0.id);
			stowaway0.once('signed key', () => {
				stowaway0.messagePublic(channel0, 'thanks!');
				stowaway0.signKey(channel0, stowaway1.id);
			});
			stowaway1.once('signed key', async () => {
				await stowaway1.messageSigned(channel1, 'FELLOW STOWAWAY');
				client0.once('message', async () => {
					await stowaway0.messageSigned(channel0, 'MON FRERE');
					client1.once('message', resolve);
				});
			});
		});
		await sleep(5);

		// key revocation
		const { key: k0, revocationCertificate: rc0 } = await genKey();
		await stowaway0.revokeKey(client0, key0, k0, rCert0);

		// CLEANUP
		await sleep(10);
		client0.destroy();
		client1.destroy();
		console.log('TESTING COMPLETE!');
		process.exit(0);
	}
	catch (err) {
		console.error(err);
		process.exit(1);
	}
}


async function testSingle () {
	const rl = require('readline').createInterface({
		input: process.stdin,
		output: process.stdout
	});
	const onEnter = async function (text, callback) {
		return new Promise(resolve => {
			rl.question(text, () => { callback(resolve); });
		});
	};
	const VERSION = '1.0.0-testing';
	const { key, revocationCertificate } = await genKey();
	const client = await clientLogin(token1);
	const stowaway = new Stowaway(new Datastore(), keyPath1, VERSION);
	stowaway.on('test', text => {
		console.log(`${client.user.tag}: ${text}`);
	});
	stowaway.on('notify', (color, text) => {
		console.log(`\t${client.user.tag} ${color}: ${text}`);
	});
	stowaway.on('error', text => {
		console.error(`${client.user.tag}: ${text}`);
	});
	stowaway.launch(client, key);
	const channel = await client.channels.fetch(channels1[0]);
	await onEnter('Press [Enter] to handshake channel', resolve => {
		stowaway.loadChannel(channel)
		.then(() => { resolve(); });
	});
	await onEnter('Press [Enter] to send a public & signed messages to channel', resolve => {
		Promise.all([
			stowaway.messagePublic(channel, 'HELLO (publicly)'),
			stowaway.messageSigned(channel, 'HELLO (privately)')
		])
		.then(() => { resolve(); });
	});
	await onEnter ('Press [Enter] to sign a key', resolve => {
		stowaway.signKey(channel, '757737270051733604')
		.then(() => { resolve(); });
	});
	await onEnter('Press [Enter] to send a public & signed messages to channel', resolve => {
		Promise.all([
			stowaway.messagePublic(channel, 'bruh (publicly)'),
			stowaway.messageSigned(channel, 'bruh (privately)')
		])
		.then(() => { resolve(); });
	});
	await onEnter('Press [Enter] to revoke your key', resolve => {
		genKey().then(({ key: temp }) => stowaway.revokeKey(client, key, temp, revocationCertificate))
		.then(() => { resolve(); });
	});
	process.exit(0);
}

if (require.main === module) {
	// test();
	testSingle();
}

module.exports = {
	clientLogin,
	genKey,
	writeKey: async keyPath => {
		const { key } = await genKey();
		fs.writeFile(keyPath, key.armor(), 'utf8', err => {
			if (err != null) {
				console.error(err);
			}
			else {
				console.log('DONE!');
			}
		});
	},
	loadKey: keyPath => {
		return new Promise((resolve, reject) => {
			fs.readFile(keyPath, 'utf8', (err, data) => {
				if (err != null) {
					reject(err);
				}
				else {
					openpgp.readKey({ armoredKey: data })
					.then(key => {
						resolve({ key });
					});
				}
			});
		});
	}
};
