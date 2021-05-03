const process = require('process');
const { Stowaway } = require('./src/stowaway.js');
const Datastore = require('nedb');
const { clientLogin, genKey, loadKey } = require('./test.js');
const { token1, keyPath1, db1, channels1 } = require('./test-data.js');

async function launch (freshFlag) {
	const VERSION = '1.0.0-daemon';
	const db = freshFlag ? new Datastore() : new Datastore({ filename: db1, autoload: true });
	db.persistence.setAutocompactionInterval(10000);
	const client = await clientLogin(token1);
	const { key } = freshFlag ? await genKey() : await loadKey(keyPath1);
	const stowaway = new Stowaway(db, keyPath1, VERSION);
	stowaway.on('notify', (color, text) => {
		console.log(`\t${client.user.tag} ${color}: ${text}`);
	});
	stowaway.on('error', text => {
		console.error(`${client.user.tag}: ${text}`);
	});
	stowaway.launch(client, key);
	let channel;
	console.log(`${freshFlag ? 'fresh' : 'cached'} deadhead: ${client.user.tag}`);
	for (let i = 0; i < channels1.length; i++) {
		channel = await stowaway.loadChannel(await client.channels.fetch(channels1[i]));
		console.log(`\tdeadheading: ${channel.guild.name} #${channel.name}`);
	}
}

launch(process.argv.length > 2 ? process.argv[2] === '--fresh' : false);
