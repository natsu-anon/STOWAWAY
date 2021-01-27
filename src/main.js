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
const HANDSHAKE_REGEX = /#### HANDSHAKE_0 (?<id>\d*) ####/g; // use regex.exec() to get the captring group
const GUILD_REGEX = /-g (?<id>\d*)/g; // use regex.exec() to get the captring group
const HANDSHAKE_REQUEST = "#### HANDSHAKE_0 id ####"; // must also include id of shared guild
const HANDSHAKE_RESPONSE = "#### HANDSHAKE_1 id ####"; // must also include id regex'd from request
const ENCRYPTED_MESSAGE = "#### STOWAWAY ####"
const KEYFILE = "pubkey.txt";
const MSGFILE = "pgpmsg.txt";
// TODO later versions: revocation & signature

console.log(fs.readFileSync('./banner.txt', 'utf8'));
console.log("Licensed via WTFPL, 2021\n");

function empty () {}

const clientEvents = new EventEmitter();
/* EVENTS:
	error
	bad handshake - user
	good handshake - user
	failed decryption - channel, user, timestamp
	decrypted message - channel, user, timestamp, decrypted content
	plaintext message - channel, user, timestamp, content, attachments
*/
// subscribe to events with event.on(eventName, callback);
// raise events with event.emit(eventName, [...args]);

function textAttachment (str, name) {
	return new MessageAttachment(Buffer.from(str, 'utf8'), name);
}

function handshakeGuild (guild, db, key) {
	guild.members.fetch()
		.then((members) => {
			members.filter(members => member.user.bot && member.user.id != client.user.id)
				.each((member) => {
					db.findOne({ id: member.user.id }, (err, doc) => {
						if (err) {
							clientEvents.emit('error');
						}
						else if (doc == null) {
							member.createDM()
								.then((channel) => {
									handshake(channel, key, guild.id);
								})
						}
						else {
							doc.update({ id: member.user.id}, { $push: { guilds: guild.id }}, {}, empty);
						}
					});
				});
		})
		.catch((err) => { clientEvents.Emit('error', err) });
}

function handshake (channel, key, id) {
	const attachment = textAttachment(key.toPublic().armor(), KEYFILE);
	channel.send(HANDSHAKE_REQUEST.replace('id', id), attachment);
}

function handshakeResponse () {
}

function guildCheck (client, id) {
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
		client.once('ready', () => {
			// console.log("#### IN READY");
			// // console.log(client.guilds);
			// client.guilds.cache.every((g) => {
			// 	console.log(g.members);
			// 	g.members.fetch()
			// 		.then(console.log)
			// 		.catch(console.error)
			// 		.finally(() => { console.log("\n#### READY MEMBER FETCH"); });
			// });
			// console.log("#### OUT READY");
		});
		client.on('guildCreate', (guild) => {
			handshakeGuild(guild, db, key);
		});
		client.on('guildDelete', (guild) => {
			// remove guildID from all ids
		});
		client.on('message', (message) => {
			let result;
			// if (message.author.id != client.user.id) {
			// 	console.log(message.content);
			// 	handshake(message.channel, key, "DEBUG");
			// }
			// if (GUILD_REGEX.test(message.content)) {
			if (message.author.id != client.user.id) {
				console.log("MESSAGE!");
			}
			if ((result = GUILD_REGEX.exec(message.content)) != null) {
				console.log(message.content);
				console.log(result);
				GUILD_REGEX.lastIndex = 0; // NOTE have to reset lastIndex
				client.guilds.fetch(result.groups.id)
					.then((guild) => {
						console.log(guild.name);
						// console.log(GUILD_REGEX.test("-g 51"));
					})
					.catch(console.error);
				// client.guilds.fetch(GUILD_REGEX.exec(message.content).groups.id)
				// 	.then((guild) => { console.log(guild.name); })
				// 	.catch(console.error);
			}
			// if (msg.content === ABOUT) {
			// 	msg.channel.send(ABOUT_RESPONSE);
			// }
			// else if (msg.author.id != client.user.id && HANDSHAKE_REGEX.test(msg.content) && msg.attachments != null) {
			// 	const guildID = HANDSHAKE_REGEX.exec(msg.content).groups.id;
			// 	handshakeResponse(msg.author.id, guildID,
			// }
			// else if (msg.content === ENCRYPTED_MESSAGE && msg.attachments != null) {
			// 	// if successful decryption
			// 	clientEvents.emit('decrypted message', msg.channel, msg.author, msg.createdTimestamp, decryptedContent);
			// 	// else
			// 	clientEvents.emit('failed decryption', msg.channel, msg.author, msg.createdTimestamp);
			// 	// initiate handshake protocol with author
			// }
			// else {
			// 	clientEvents.emit('plaintext message', msg.channel, msg.author, msg.createdTimestamp, msg.content, msg.attachments);
			// }
			//
			// // console.log(msg.attachments);
			// console.log(msg.author.id);
			// if (msg.author.id != client.user.id) { // don't respond to yourself
			// 	db.findOne({ publicKey: { $exists: true }}, (err, doc) => {
			// 		// note lmao send private key and neck yourself
			// 		const a = new MessageAttachment(Buffer.from(doc.publicKey, 'utf8'), 'reply.txt');
			// 		msg.channel.send("FUGGGG", a)
			// 	});
			// }
			// for (let attachment of msg.attachments) {
			// 	console.log(attachment[1].name);
			// 	https.get(attachment[1].url, (res) => {
			// 		res.on('data', (data) => {
			// 			console.log(data.toString());
			// 		});
			// 	});
			// 	// fs.readFile(attachment[1].url, 'utf8', (err, data) => {
			// 	// 	if (err) throw err;
			// 	// 	console.log(data);
			// 	// });
			// }
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
