const fs = require('fs');
const readline = require('readline');
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

const messages = [];

// create an console interface
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

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
		console.log('plaintext downloaded');
		return openpgp.message.readArmored(message);
	})
	.then((message) => {
		console.log('decrypting');
		return openpgp.decrypt({
			message: message,
			privateKeys: key
		});
	})
	.then((res) => {
		clientEvents.emit('encrypted', channel, user, timestamp, res.data);
	})
	.catch((err) => {
		console.error(err);
		clientEvents.emit('bad decrypt', channel, user, timestamp);
	})
	.finally(() => { console.log('DECYPTION COMPLETE'); });
	// })
	// .catch((err) => { clientEvents.emit('bad stowaway', channel, user, timestamp); });
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
			// console.log('message!');
			if (message.author.id != client.user.id) {
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
			if (message.content === ENCRYPTED_MESSAGE && message.attachments.size > 0) {
				// if it's an encrypted message attempt todecrypt then display
				console.log('encrypted message!');
				const msgfile = message.attachments.find(attachment => attachment.name === MSGFILE);
				if (msgfile != null) {
					console.log('decrypting!');
					decrypt(message.channel, message.author, message.createdAt, msgfile.url, key);
				}
				else {
					clientEvents.emit('bad stowaway', message.channel, message.author, message.createdAt);
				}
			}
			else if (message.attachments.size > 0) {
				clientEvents.emit('plaintext', message.channel, message.author, message.createdAt, message.cleanContent, message.attachments);
			}
			else {
				// console.log(`${channel.name}(\x1b[32m${channel.id}\x1b[0m)\n${user.tag} - ${content}`);
				clientEvents.emit('plaintext', message.channel, message.author, message.createdAt, message.cleanContent);
			}
		});
		return client;
	};
}

require('./database.js').Init(rl, openpgp)
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
	clientEvents.on('encrypted', (channel, author, timestamp, content) => {
		messages.push({ encrypted: true, channel: channel, author: author, timestamp: timestamp, content: content});
	});
	clientEvents.on('plaintext', (channel, author, timestamp, content, attachments) => {
		messages.push({ encrypted: false, channel: channel, author: author, timestamp: timestamp, content: content, attachments: attachments });
	});
	main(key, db, client);
	// console.log(client.guilds);
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
	/*
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
	*/
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


/* STOWAWAY VERSION 0.0.1 */

const ENCRYPTED = /encrypted\s+(?<channel>\d+)\s+(?<message>.+)/;
const PLAINTEXT = /plaintext\s+(?<channel>\d+)\s+(?<message>.+)/;

function main (key, db, client) {
	rl.question(messages.length > 0 ? `${messages.length} new messages!, enter 'messages' to read them!\n>` : '>', (input) => {
		if (input === 'list') {
			client.guilds.cache.each((guild) => {
				console.log(`${guild.name}`);
				guild.channels.cache.filter(channel => channel.isText())
				.each(channel => console.log(`- \x1b[32m${channel.id}\x1b[0m ${channel.name}`));
			});
			main(key, db, client);
			// list all the text channels
		}
		else if (input === 'messages') {
			// list all recieved messages
			let message;
			while (messages.length > 0) {
				message = messages.pop();
				if (message.encrypted) {
					console.log(`\x1b[42m\x1b[30mENCRYPTED\x1b[0m ${message.channel.name}(\x1b[32m${message.channel.id}\x1b[0m) ${message.author.tag}\n\t${message.content}`);
				}
				else {
					console.log(`PLAINTEXT ${message.channel.name}(\x1b[32m${message.channel.id}\x1b[0m) ${message.author.tag}\n\t${message.content}`);
				}
			}
			main(key, db, client);
		}
		// else if (input === 'help') {
		// lmao get fucked
		// 	// show the help string
		// 	main(key, db, client);
		// }
		else if (input === 'handshake') {
			console.log('handhsake every bot user of every guild fuggit');
			main(key, db, client);
		}
		else if (input === 'quit') {
			process.exit();
			main(key, db, client);
		}
		else if (PLAINTEXT.test(input)) {
			const res = PLAINTEXT.exec(input);
			new Promise((resolve, reject) => {
				client.channels.fetch(res.groups.channel)
				.then((channel) => {
					channel.send(res.groups.message)
					.catch((err) => {
						console.log(`\x1b[31munexpected failure sending plaintext message to ${channel.name}\x1b[0m`);
					})
					.finally(resolve);
				})
				.catch((err) => {
					console.log(`\x1b[31mcould not find channel with supplied id: \x1b[4m${res.groups.channel}\x1b[0m`);
					resolve();
				})
			})
			.finally(() => { main(key, db, client); });
		}
		else if (ENCRYPTED.test(input)) {
			const res = ENCRYPTED.exec(input);
			// console.log(`encrypted message to: ${res.groups.channel}\n${res.groups.message}`);
			new Promise((resolve, reject) => {
				client.channels.fetch(res.groups.channel)
				.then((channel) => {
					// console.log(channel.name);
					// GET ALL THE KEYS PLS
					openpgp.encrypt({
						message: openpgp.message.fromText(res.groups.message),
						publicKeys: [ key ]
					})
					.then((encrypted) => {
						const attachment = attachText(encrypted.data, MSGFILE);
						return channel.send(ENCRYPTED_MESSAGE, attachment);
					})
					.catch((err) => {
						console.log(`\x1b[31munexpected failure sending encrypted message to ${channel.name}\x1b[0m`);
					})
					.finally(resolve)
				})
				.catch((err) => {
					console.log(`\x1b[31mcould not find channel with supplied id: \x1b[4m${res.groups.channel}\x1b[0m`);
				})
				.finally(resolve);
			})
			.finally(() => { main(key, db, client); });
		}
		else {
			console.log(`failed to recognize input '${input}', enter 'help' to list commands`);
			main(key, db, client);
		}
	});
}
