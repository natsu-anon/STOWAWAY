const fs = require('fs');
const EventEmitter = require('events');
const https = require('https');
const process = require('process');
const openpgp = require('openpgp');
const blessed = require('blessed');
const { MessageAttachment } = require('discord.js');

// just JUST my shit up fam
const ABOUT = "--about";
const HANDSHAKE_REQUEST = "#### HANDSHAKE_0 ####";
const HANDSHAKE_RESPONSE = "#### HANDSHAKE_1 ####";
const ENCRYPTED_MESSAGE = "#### STOWAWAY ####"
const KEYFILE = "pubkey.txt";
const MSGFILE = "pgpmsg.txt";
// TODO later versions: revocation & signature

console.log(fs.readFileSync('./banner.txt', 'utf8'));
console.log("Licensed via WTFPL\n");

const events = new EventEmitter();
// subscribe to events with event.on(eventName, callback);
// raise events with event.emit(eventName, [...args]);

function prepClient (db) {
	return (client) => {
		client.on('message', (msg) => {
			// console.log(msg.attachments);
			console.log(msg.author.id);
			if (msg.author.id != client.user.id) { // don't respond to yourself
				db.findOne({ publicKey: { $exists: true }}, (err, doc) => {
					// note lmao send private key and neck yourself
					const a = new MessageAttachment(Buffer.from(doc.publicKey, 'utf8'), 'reply.txt');
					msg.channel.send("FUGGGG", a)
				});
			}
			for (let attachment of msg.attachments) {
				console.log(attachment[1].name);
				https.get(attachment[1].url, (res) => {
					res.on('data', (data) => {
						console.log(data.toString());
					});
				});
				// fs.readFile(attachment[1].url, 'utf8', (err, data) => {
				// 	if (err) throw err;
				// 	console.log(data);
				// });
			}
			// if (msg.attachments != null) {
			// 	console.log(msg.attachments);
			// 	// fs.readFile(msg.attachments[1].url, 'utf8', (err, data) => {
			// 	// 	if (err) throw err;
			// 	// 	console.log(data);
			// 	// });
			// }
			// console.log(msg.attachment
			// console.log(msg.content);
			// console.log(msg.channel);
			// if (msg.channel.type === "dm") {
			// 	console.log(`DM from ${msg.author.tag}`);
			// }
			// if (msg.content === ABOUT && !msg.author.bot) {
			// 	// if sent -about from a non-bot reply with the about
			// }
			// else if (msg.content === HANDSHAKE_REQUEST && msg.attachments[0]) {
			// 	// add user to db w/ public key & id
			// 	// reply with
			// }
			// else if (msg.content === ENCRYPTED_MESSAGE) {
			// 	// attempt to decrypt the message
			// 	// if decryption fails, begin handshake protocol w/ author
			// 	// else display the message
			// }
			// else {
			// 	// display the message
			// }
		});
		return client;
	};
}

require('./database.js').Init(openpgp)
	.then((db) => {
		return new Promise((resolve, reject) => {
			require('./client.js').Login(fs, prepClient(db))
			.then((cli) => {
				resolve({
					database: db,
					client: cli
				});
			})
			.catch(reject);
		});
	})
	.then(({database: db, client: cli}) =>  {
		console.log(`logged in as: ${cli.user.tag}`);
		console.log("LAUNCH BLESSED");
		console.log(ENCRYPTED_MESSAGE);
	})
	.catch((err) => { console.error(err); });


function main (db, cli) {
	// TODO
}
