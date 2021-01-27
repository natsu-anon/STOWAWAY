const fs = require('fs');
const EventEmitter = require('events');
const https = require('https');
const process = require('process');
const openpgp = require('openpgp');
const blessed = require('blessed');
const { Client, MessageAttachment } = require('discord.js');

// just JUST my shit up fam
const ABOUT = "--about";
const ABOUT_RESPONSE = "TODO";
const HANDSHAKE_REQUEST = "#### HANDSHAKE 0 ####";
const HANDSHAKE_RESPONSE = "#### HANDSHAKE 1 ####";
const ENCRYPTED_MESSAGE = "#### STOWAWAY ####"
const KEYFILE = "pubkey.txt";
const MSGFILE = "pgpmsg.txt";
// TODO later versions: revocation & signature

console.log(fs.readFileSync('./banner.txt', 'utf8'));
console.log("This software is licensed under the WTFPL\n");

function empty () {}

const clientEvents = new EventEmitter();
/* EVENTS:
	error
	handshake - user
	bad handshake - user
	bad stowaway - channel, user, timestamp
	bad decrypt - channel, user, timestamp
	encrypted - channel, user, timestamp, decrypted content
	plaintext - channel, user, timestamp, content, attachments
*/
// subscribe to events with event.on(eventName, callback);
// raise events with event.emit(eventName, [...args]);

function attachText (text, name) {
	return new MessageAttachment(Buffer.from(text, 'utf8'), name);
}

function readAttached (url) {
	return new Promise((resolve, reject) => {
		https.get(url, (response) => {
			response.on('data', (d) => { resolve(d.toString()); });
			response.on('error', (e) => { reject(e); });
		});
	});
}

function handshake (channel, key, id, str) {
	const attachment = attachText(key.toPublic().armor(), KEYFILE);
	channel.send(str, attachment);
}

function handshakeGuild (guild, db, key) {
	guild.members.fetch()
	.then((members) => {
		members.filter((members) => { member.user.bot && member.user.id != client.user.id })
		.each((member) => {
			db.findOne({ id: member.user.id }, (err, doc) => {
				if (err) {
					clientEvents.emit('error', err);
				}
				else if (doc == null) {
					member.createDM()
					.then((channel) => {
						handshake(channel, key, HANDHSAKE_REQUEST);
					})
				}
			});
		});
	})
	.catch((err) => { clientEvents.emit('error', err) });
}

// NOTE key is an optional argument
function receiveHandshake (user, keyURL, db, key) {
	db.findOne({ id: user.id }, (err, doc) => {
		if (err) {
			clientEvents.emit('error', err);
		}
		else if (doc == null) {
			readAttached(keyURL)
			.then((keyStr) => {
				openpgp.key.readArmored(keyStr)
				.then(({ key, err }) => {
					if (err != null) {
						db.insert({ id: user.id, key: keys[0] });
						if (key != null) {
							user.createDM()
							.then((channel) => {
								handshake(channel, key, HANDSHAKE_RESPONSE);
							});
						}
						clientEvents.emit('handshake', user);
					}
					else {
						clientEvents.emit('bad handshake', user);
					}
				})
			})
			.catch((err) => { clientEvents.emit('bad handshake', user); })
		}
	});
}

function decrypt (channel, user, timestamp, messageURL, key) {
	readAttached(messageURL)
	.then((message) => {
		openpgp.message.readAmmored(message)
		.then((res) => {
			clientEvents.emit('encrypted', channel, user, timestamp, res.data);
		})
		.catch((err) => {
			clientEvents.emit('bad decrypt', channel, user, timestamp);
		})
	})
	.catch((err) => { clientEvents.emit('bad stowaway', channel, user, timestamp); });
}

function prepClient ({ database: db, key: key }) {
	/* Client events to subscribe to:
	*  N E C E S S A R Y
	*    guildCreate -
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
	*    guildDelete -
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
		client.on('guildCreate', (guild) => {
			handshakeGuild(guild, db, key);
		});
		client.on('message', (message) => {
			if (message.author.id != client.user.id) {
				console.log("MESSAGE!");
				if (message.content === ABOUT) {
					message.channel.send(ABOUT_RESPONSE);
				}
				else if (message.content === HANDSHAKE_REQUEST && message.attachments.size > 0) {
					const keyfile = message.attachments.find(attachment => attachment.name === KEYFILE);
					if (keyfile != null) {
						receiveHandshake(message.author, keyfile.url, db, key);
					}
					else {
						clientEvents.emit('bad handshake', message.author);
					}
				}
				else if (message.content === HANDSHAKE_RESPONSE && message.attachments.size > 0) {
					const keyfile = message.attachments.find(attachment => attachment.name === KEYFILE);
					if (keyfile != null) {
						receiveHandshake(message.author, keyfile.url, db);
					}
					else {
						clientEvents.emit('bad handshake', message.author);
					}
				}
			}
			else if (message.content === ENCRYPTED_MESSAGE && message.attachments.size > 0) {
				// if it's an encrypted message attempt todecrypt then display
				const msgfile = message.attachments.find(attachment => attachment.name === MSGFILE);
				if (msgfile != null) {
					decrypt(message.channel, message.author, message.createdAt, msgfile.url, key);
				}
				else {
					clientEvents.emit('bad stowaway', message.channel, message.author, message.createdAt);
				}
			}
			else if (message.attachments.size > 0) {
				clientEvents.emit('plaintext', message.channel, message.author, message.createdAt, message.cleanContent);
			}
			else {
				clientEvents.emit('plaintext', message.channel, message.author, message.createdAt, message.cleanContent. message.attachments);
			}
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
	console.log(`logged in as ${client.user.tag}\tid: ${client.user.id}`);
	console.log(client.guilds);
	// console.log(client.users);
	// console.log(client.guilds);
	// console.log(client.channels);
	// const res = client.guilds.cache.array();
	// console.log(res);
	// for (let i = 0; i < res.length; i++) {
	// 	console.log(res[i]);
	// }
	// console.log(client.channels);
	// console.log("\n#### CACHE");
	// console.log(client.channels.cache);
	client.guilds.cache.each((guild) => {
		// console.log("\n### GUILD");
		// console.log(guild);
		// console.log(guild.members);
		// console.log("\n### MEMBERS");
		// guild.members.cache.each((member)  => {
		// 	console.log(member);
		// });
		// console.log("\n### MEMBERS FETCH");
		guild.members.fetch()
			.then((members) => {
				members
				.filter((m) => m.user.bot && m.user.id != client.user.id)
				.each((m) => console.log(m.user.tag));
				// console.log(res);
				// console.log(res.size);
				// for (int i = 0; i < res.length; i++) {
				// 	console.log(res[i]);
				// }
			})
			.catch(console.error)
			.finally(() => { console.log("\n### FETCHED "); });
	});
	// console.log(client.users);
	// client.channels.each(channel => { console.log(channel); });
		// .filter(channel => channel.istText())
		// .each(channel => console.log(channel));
	// client.guilds.cache.each((guild) => {
	// 	console.log(guild.channels);
	// 	// console.log("\n#### MEMBERS ####\n");
	// 	// guild.members.cache.each(member => console.log(member));
	// 	// console.log(guild.presences);
	// });
	// console.log(client.guilds);
	// client.guilds.cache.each((guild) => {
	// 	// console.log(guild.members)
	// 	guild.members.fetch({ force: true })
	// 		.then(console.log)
	// 		.catch(console.error)
	// 		.finally(() => { console.log("\n\n#### FETCH COMPLETE"); });
	// });
	// for (let guild in client.guilds) {
	// 	console.log(guild);
	// }

})
.catch((err) => { console.error(err); });


function main (db, cli) {
	// TODO
}
