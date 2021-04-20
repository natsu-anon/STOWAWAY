const { Stowaway } = require('./src/stowaway.js');
const Datastore = require('nedb');
const { clientLogin, loadKey } = require('./test.js');
const { token1,  keyPath1, db1, channels1 } = require('./test-data.js');

async function launch () {
	const VERSION = '1.0.0-daemon';
	const db = new Datastore({ filename: db1, autoload: true });
	db.persistence.setAutocompactionInterval(10000);
	const client = await clientLogin(token1);
	const key = await loadKey(keyPath1);
	const stowaway = new Stowaway(db, keyPath1, VERSION);
	stowaway.on('notify', (color, text) => {
		console.log(`\t${client.user.tag} ${color}: ${text}`);
	});
	stowaway.on('error', text => {
		console.error(`${client.user.tag}: ${text}`);
	});
	stowaway.launch(client, key);
	for (let i = 0; i < channels1.length; i++) {
		await stowaway.loadChannel(await client.channels.fetch(channels1[i]));
	}
	console.log(`deadhead: ${client.user.tag}`);
}

launch();

