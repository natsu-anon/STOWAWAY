const EventEmitter = require('events');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const Datastore = require('nedb');
const { Client } = require('discord.js');
const ChannelsModel = require('./models/channels-model.js');
const ChannelsMediator = require('./mediators/channels-mediator.js');
const phrase = require('./nato-phrase.js');
const API_TOKEN = './token DO NOT SHARE';
const DATABASE = './stowaway.db';
const REGEX = /^#{4} STOWAWAY #{4}$/m;

/* lmao didn't work
// https.get("api.github.com/repos/natsu-anon/STOWAWAY/releases", response => {
const options = {
	// hostname: "api.github.com",
	// path: "repos/octocat/hello-world/releases",
	headers: { 'User-Agent': 'Mozilla/5.0' }
};
// https.get(options, response => {
https.get("https://api.github.com/repos/octocat/hello-world/releases", options, response => {
	response.on('data', data => { console.log(data); });
	response.on('error', err => { throw err; });
});
*/

console.log(phrase());

const db = new Datastore({ filename: DATABASE, autoload: true });
db.persistence.setAutocompactionInterval(5000);
return new Promise((resolve, reject) => {
	const client = new Client();
	client.once('ready', () => {
		resolve(client);
	});
	fs.readFile(API_TOKEN, 'utf8', (err, data) => {
		if (err) {
			reject(err);
		}
		else {
			client.login(data);
		}
	});
})
.then(client => {
	console.log(`logged in as ${client.user.tag}\tid: ${client.user.id}`);
	// client.on('message', message => {
	// 	console.log(typeof message.createdTimestamp);
	// 	console.log(message.createdTimestamp);
	// });
	https.get('https://raw.githubusercontent.com/natsu-anon/STOWAWAY/development/version.json', response => {
		response.on('data', data => { console.log(JSON.parse(data.toString())); });
		response.on('err', err => { throw err; });
	});
	// 	client.destroy();
	// client.on('message', message => {
	// 	console.log(REGEX.test(message.content));
	// });
	// const db = new Datastore({ filename: './stowaway.db', autoload: true });
	// db.persistence.setAutocompactionInterval(5000);
	// db.find({ user_key: { $exists: true } }, (err, docs) => {
	// 	if (err) {
	// 		throw err;
	// 	}
	// 	console.log(docs);
	// 	process.exit(0);
	// });
	// client.guilds.cache.each(guild => {
	// 	console.log(typeof guild.id);
	// 	guild.channels.cache.filter(channel => channel.isText())
	// 	.each(channel => {
	// 		console.log(channel.name);
	// 		console.log(`\tcan view: ${channel.permissionsFor(client.user).has('VIEW_CHANNEL')}`);
	// 		console.log(`\tcan message: ${channel.permissionsFor(client.user).has('SEND_MESSAGES')}`);
	// 		console.log(`\tread history: ${channel.permissionsFor(client.user).has('READ_MESSAGE_HISTORY')}`);
	// 	});
	// });

	// console.log(crypto.getHashes());
})
.catch(err => { console.error(err); });
