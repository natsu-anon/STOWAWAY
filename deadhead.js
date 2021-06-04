const process = require('process');
const { Stowaway } = require('./src/stowaway.js');
const database = require('./src/database.js');
const { clientLogin, genKey, loadKey } = require('./test.js');
const { token1, keyPath1, db1, channels1 } = require('./test-data.js');

async function launch (freshFlag) {
	console.log(`### DEADHEAD ${freshFlag ? 'FRESH' : 'CACHED'}`);
	const VERSION = '1.1.0-deadhead';
	const { db, channels, peers, revocations } = freshFlag ? await database('deadhead.db', false) : await database(db1);
	const quit = () => {
		if (!freshFlag) {
			db.close(() => { process.exit(0); });
		}
	};
	const client = await clientLogin(token1);
	const { key } = freshFlag ? await genKey() : await loadKey(keyPath1);
	const stowaway = new Stowaway(channels, peers, revocations, freshFlag ? 'fresh.key' : keyPath1, VERSION, 'deadhead', true);
	stowaway.on('debug', text => {
		console.log(text);
	});
	stowaway.on('notify', (color, text) => {
		console.log(`\t${client.user.tag} ${color}: ${text}`);
	});
	stowaway.on('error', text => {
		console.error(`${client.user.tag}: ${text}`);
	});
	stowaway.launch(client, key, 'deadhead');
	let channel;
	console.log(`deadhead: ${client.user.tag}`);
	for (let i = 0; i < channels1.length; i++) {
		channel = await stowaway.loadChannel(await client.channels.fetch(channels1[i]));
		console.log(`\tdeadheading: ${channel.guild.name} #${channel.name}`);
	}
	process.once('SIGHUP', quit);
	process.once('SIGINT', quit);
}

launch(process.argv.length > 2 ? process.argv[2] === '--fresh' : false);

