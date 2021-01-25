const fs = require('fs');
const EventEmitter = require('events');
const https = require('https');
const process = require('process');
const openpgp = require('openpgp');
const blessed = require('blessed');
const { Client, MessageAttachment } = require('discord.js');

// just JUST my shit up fam
const ABOUT = "--about";
const ABOUT_RESPONSE = `TODO`;
const HANDSHAKE_REGEX = /#### HANDSHAKE_0 (?<id>\d*) ####/g; // use regex.exec() to get the captring group
const HANDSHAKE_REQUEST = "#### HANDSHAKE_0 id ####"; // must also include id of shared guild
const HANDSHAKE_RESPONSE = "#### HANDSHAKE_1 id ####"; // must also include id regex'd from request
const ENCRYPTED_MESSAGE = "#### STOWAWAY ####"
const KEYFILE = "pubkey.txt";
const MSGFILE = "pgpmsg.txt";
// TODO later versions: revocation & signature

console.log(fs.readFileSync('./banner.txt', 'utf8'));
console.log("Licensed via WTFPL\n");

const clientEvents = new EventEmitter();
/* EVENTS:
	bad handshake - user
	good handshake - user
	failed decryption - channel, user, timestamp
	decrypted message - channel, user, timestamp, decrypted content
	plaintext message - channel, user, timestamp, content, attachments
*/
// subscribe to events with event.on(eventName, callback);
// raise events with event.emit(eventName, [...args]);

function userHandhsake (user, guildID) {
}

function handshakeRequest (user, handshake, attachments, db, key, channel) {
	// if you fail to  get a key from the attachments emit a "bad handshake"
	const guildID = HANDSHAKE_REGEX.exec(handshake).groupds.id; // the id of shared guild
	// check to see if user id already exists in db
	// if yes just add the guildID
	// if no follow through with entire handshake protocol
}

function prepClient ({ database: db, key: key }) {
	/* Client events to subscribe to:
	*  N E C E S S A R Y
	*    guildCreate -
	*    guildDelete -
	*    message -
	*
	*  Nice to have
	*    error - for debugging & error logging
	*    invalidated
	*    channelCreate
	*    channelDelete
	*    channelUpdate
	*    guildBanAdd
	*    guildBanRemove
	*    guildMemberAdd
	*    guildMemberRemove
	*    guildMemberUpdate
	*    guildUnavailable
	*    guildUpdate
	*    messageUpdate
	*    presenceUpdate
	*    userUpdate
	*/
	return (client) => {
		client.on('guildCreate', (gld) => {
			// iterate over all users
			// if the user is a bot (1) check database to see if user id already exists
			// if exists add guild id to entry's list of guild ids
			// if does not exist begin handshake protocol
		});
		client.on('guildDelete', (gld) => {
		});
		client.on('message', (msg) => {
			if (msg.content === ABOUT) {
				msg.channel.send(ABOUT_RESPONSE);
			}
			else if (msg.author.id != client.user.id && HANDSHAKE_REGEX.test(msg.content) && msg.attachments != null) {
				// handshakeResponse(msg.author, msg.content, , db, key, msg.channel);
			}
			else if (msg.content === ENCRYPTED_MESSAGE && msg.attachments != null) {
				// if successful decryption
				clientEvents.emit('decrypted message', msg.channel, msg.author, msg.createdTimestamp, decryptedContent);
				// else
				clientEvents.emit('failed decryption', msg.channel, msg.author, msg.createdTimestamp);
				// initiate handshake protocol with author
			}
			else {
				clientEvents.emit('plaintext message', msg.channel, msg.author, msg.createdTimestamp, msg.content, msg.attachments);
			}

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
	.then((data) => {
		return new Promise((resolve, reject) => {
			require('./client.js').Login(fs, Client, prepClient(data))
			.then((client) => {
				data.client = client
				resolve(data);
			})
			.catch(reject);
		});
	})
	.then(({key: key, database: db, client: client}) =>  {
		console.log(`logged in as ${client.user.tag}`);
		console.log(`id ${client.user.id}`);
	})
	.catch((err) => { console.error(err); });


function main (db, cli) {
	// TODO
}
