const EventEmitter = require('events');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const openpgp = require('openpgp');
const { MessageAttachment } = require('discord.js');


/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - *
/* PROTOCOL CONSTS -- DO NOT TOUCH AFTER 1.0.0 RELEASE -- THIRD RAIL OF STOWAWAY
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -*/


const STOWAWAY = '#### STOWAWAY ####';
const STOWAWAY_RGX = /^#{4} STOWAWAY #{4}$/m;
const FILE = 'STOWAWAY.json';
const CHANNEL_MESSAGE = 'channel_message';
const HANDSHAKE = 'handshake';
const SIGNED_KEY = 'signed_key';
// const KEY_UPDATE = 'key_update';
const REVOCATION = 'revocation'; 


/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - *
/* ok to touch
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -*/


const ERR_SYNTAX = 'SyntaxError';
// this is janky but w/e openpgp doesn't have custom errors yet
const ERR_ARMORED = 'Misformed armored text';
const ERR_DECRYPT = 'Error decrypting message: Session key decryption failed.';
const ERR_UPDATE = 'Key update method: fingerprints of keys not equal';
const ERR_WRITE = 'Write Error';
const ERR_REVOCATION_RGX = /^Could not find valid key revocation signature in key .+$/;
const ERR_PASSPHRASE_RGX = /Private key is not decrypted\.$/;

// permissions
const VIEW = 'VIEW_CHANNEL';
const SEND = 'SEND_MESSAGES';
const READ = 'READ_MESSAGE_HISTORY';

function Permissions (channel, user) {
	const permissions = channel.permissionsFor(user);
	const viewable = permissions.has(VIEW);
	const sendable = permissions.has(SEND);
	const readable = permissions.has(READ);
	return {
		valid: viewable && sendable && readable,
		viewable,
		sendable,
		readable,
	};
}

function readAttached (url) {
	return new Promise((resolve, reject) => {
		https.get(url, response => {
			let buffer = Buffer.alloc(0);
			response.once('end', () => {
				if (response.complete) {
					resolve(buffer.toString());
				}
				else {
					reject(Error(`Connection was terminated while response from ${url} was still being set!`));
				}
			});
			response.on('data', data => {
				buffer = Buffer.concat([ buffer, Buffer.from(data) ]);
			});
		}).on('error', reject);
	});
}

function attachText (text, name) {
	return new MessageAttachment(Buffer.from(text, 'utf8'), name);
}


function attachJSON (json, name) {
	return attachText(JSON.stringify(json, null, '\t'), name);
}

function getAttachment (message, name=FILE) {
	const file = message.attachments.find(a => a.name === name);
	if (file != null) {
		return { exists: true, url: file.url };
	}
	else {
		return { exists: false };
	}
}

function hash (input) {
	return crypto.createHash('blake2s256').update(input).digest('base64');
}


class Messenger {
	constructor (stowaway) {
		this.stowaway = stowaway;
	}

	message (plainText) {
		if (this.channel != null && this.publicFlag != null) {
			if (this.publicFlag) {
				this.stowaway.messagePublic(this.channel, plainText);
			}
			else {
				this.stowaway.messageSigned(this.channel, plainText);
			}
			return true;
		}
		else {
			return false;
		}
	}
}

/* EVENTS
	channel delete
	channel update
	message
	timestamp
	failed decrypt
	failed encrypt
	handshake
	bad handshake
	database error
*/
class Stowaway extends EventEmitter {

	constructor (db, channels, peers, revocations, keyFile, version, comment='') {
		super();
		this.db = db;
		this.channels = channels;
		this.peers = peers;
		this.revocations = revocations;
		this.keyFile = keyFile;
		this.version = version;
		this.discordMessage = `${STOWAWAY}\nVERSION: ${version}`;
		if (comment.length > 0) {
			this.discordMessage += `\nUser comment: ${comment}`;
		}
	}

	get _armoredPublicRevocations () {
		return new Promise((resolve, reject) => {
			this._revocations.then(revocations => {
				if (revocations.length > 0) {
					resolve(revocations.map(x => x.toPublic().armor()));
				}
				else {
					resolve([]);
				}
			})
			.catch(reject);
		});
	}

	get _revocations () {
		return new Promise((resolve, reject) => {
			this.db.find({ revocation_certificate: { $exists: true } }, (err, docs) => {
				if (err != null) {
					reject(err);
				}
				else if (docs.length > 0) {
					Promise.all(docs.map(x => openpgp.readKey({ armoredKey: x.revocation_certificate })))
					.then(resolve)
					.catch(reject);
				}
				else {
					resolve([]);
				}
			});
		});
	}

	fetchNewer (channel, messageID) {
		return new Promise((resolve, reject) => {
			this._findChannel(channel.id, (err, doc) => {
				if (err != null) {
					this.emit('error', `database error in Stowaway.fetchNewer() channel_id: ${channel.id}`);
					reject(err);
				}
				if (doc != null) {
					channel.messages.fetch({ after: messageID }, false, false)
					.then(messages => {
						messages.sort((m0, m1) => m0.createdTimestamp - m1.createdTimestamp)
						.each(message => {
							this._handleActive(message);
						});
						resolve();
					})
					.catch(reject);
				}
			});
		});
	}

	fetchOlder (channel, messageID) {
		return new Promise((resolve, reject) => {
			this._findChannel(channel.id, (err, doc) => {
				if (err != null) {
					this.emit('error', `database error in Stowaway.fetchOlder() channel_id: ${channel.id}`);
					reject(err);
				}
				if (doc != null) {
					channel.messages.fetch({ before: messageID }, false, false)
					.then(messages => {
						messages.sort((m0, m1) => m0.createdTimestamp - m1.createdTimestamp)
						.each(message => {
							this._handleActive(message);
						});
						resolve();
					})
					.catch(reject);
				}
			});
		});
	}

	knownSignatures (userId) {
		return new Promise((resolve, reject) => {
			this._findUser(userId, async (err, doc) => {
				if (err != null) {
					this.emit('error', `database error in Stowaway.knownSignatures(), user id argument: ${userId}`);
				}
				else if (doc != null) {
					const publicKey = await openpgp.readKey({ armoredKey: doc.public_key });
					const { publicKeys, userIds } = await new Promise(res => {
						this._allUsers((error, docs) => {
							if (error != null) {
								this.emit('error', 'database error in SingleStowaway.knownSignatures()');
							}
							else {
								return Promise.all(docs.map(x => {
									return openpgp.readKey({ armoredKey: x.public_key });
								}))
								.then(keys => {
									res({ publicKeys: keys, userIds: docs.map(x => x.user_id) });
								})
								.catch(reject);
							}
						});
					});
					const bonafides = await publicKey.verifyPrimaruUser(publicKeys);
					const res = [];
					for (let i = 0; i < bonafides.length; i++) {
						if (bonafides[i].valid) {
							res.push(userIds[i]);
						}
					}
					resolve(res);
				}
				else {
					resolve([]);
				}
			});
		});
	}

	launch (client, key, passphrase) {
		this.client = client;
		this.id = client.user.id;
		this.key = key;
		this.passphrase = passphrase;
		this.fingerprint = key.getFingerprint();
		client.on('message', message => {
			if (message.channel.type === 'dm' && message.author.id !== this.id) {
				if (message.content.toLowerCase() === 'about stowaway') {
					let about = `Hello ${message.author.username}, I'm a STOWAWAY bot!  `;
					about += 'That means I allow my user to send & receive PGP encrypted messages with ease.  ';
					about += 'You can learn more about STOWAWAY and get your own at: https://github.com/natsu-anon/STOWAWAY';
					message.reply(about);
				}
				else {
					message.reply("dm me 'about STOWAWAY' to learn about what I do");
				}
			}
			else if (this.channelId != null && message.channel.id === this.channelId) {
				this._handleActive(message);
			}
			else {
				this._handleNotify(message);
			}
		});
		client.on('channelDelete', channel => {
			this.db.remove({ channel_id: channel.id });
		});
		client.on('channelUpdate', (ch0, ch1) => {
			if (Permissions(ch1, client.user).valid) {
				this.db.update({ channel_id: ch0.id }, { $set: { channel_id: ch1.id } });
			}
			else {
				this.db.remove({ channel_id: ch0.id });
			}
		});
		// do the same but with guild, guild update, guildMemberUpdate
		client.user.setPresence({
			activity: {
				type: 'LISTENING',
				name: ' dms for "about STOWAWAY"'
			},
			status: 'online'
		});
		// remove deleted channels from database (channels model checks independently)
		const channels = this.channels.find({ channel_id: { $exists: true } }, (err, docs) => {
			if (err != null) {
				throw err;
			}
			else {
				docs.forEach(doc => {
					client.channels.fetch(doc.channel_id, false)
					.then(channel => {
						if (channel.deleted) {
							this.db.remove({ channel_id: doc.channel_id });
						}
					});
				});
			}
		});
		return new Promise((resolve, reject) => {
			this._revocations
			.then(result => {
				this.oldKeys = result;
				resolve();
			})
			.catch(reject);
		});
	}

	// handshakes channel if not in database
	// returns a promise so you can enable autoscroll after loading
	loadChannel (channel) {
		return new Promise(resolve => {
			this._findChannel(channel.id, (err, doc) => {
				if (err != null) {
					this.emit('error', `database error in Stowaway.loadChannel(), channel id argument: ${channel.id}`);
				}
				else if (doc == null) { // handshake channel
					this._sendHandshake(channel, true)
					.then(message => {
						// this.emit('test', `${message.createdTimestamp}`);
						this.db.insert({
							channel_id: channel.id,
							handshake: {
								id: message.id,
								ts: message.createdTimestamp
							},
							last_seen: {
								id: message.id,
								ts: message.createdTimestamp
							}
						}, (err, newDoc) => {
							if (err != null) {
								this.emit('error', 'database error in Stowaway.loadChannel()');
							}
							else {
								this.emit('handshake channel', channel);
								this.emit('handshake', message, true);
								this.db.update({ last_channel: { $exists: true } }, { last_channel: channel.id }, { upsert: true });
								this.channelId = channel.id;
								this.emit('read channel', channel);
								// this.emit('test', `handshaked ${channel.guild.name} _${channel.name}`);
							}
						});
					})
					.catch(err => {
						this.emit('error', `Unexpected error in Stowaway.loadChannel() from Stowaway._sendHandshake()\n${err.stack}`);
					})
					.finally(() => {
						resolve(channel);
					});
				}
				else { // load messages around the last seen message
					channel.messages.fetch(doc.handshake.id)
					.then(message => {
						this.emit('handshake', message, true);
						return channel.messages.fetch({ around: doc.last_seen.id }, false, false);
					})
					.then(messages => {
						messages.sort((m0, m1) => m0.createdTimestamp - m1.createdTimestamp)
						.each(message => { this._handleActive(message); });
						this.db.update({ last_channel: { $exists: true } }, { last_channel: channel.id }, { upsert: true });
						this.channelId = channel.id;
						this.emit('read channel', channel);
						// this.emit('test', `active channel ${channel.guild.name} _${channel.name}`);
					})
					.catch(err => {
						this.emit('error', `unexpected error in Stowaway.loadChannel() ${err.stack}`);
					})
					.finally(() => {
						resolve(channel);
					});
				}
			});
		});
	}

	messagePublic (channel, plainText) {
		return new Promise(resolve => {
			this._publicKeys(channel)
			.then(publicKeys => openpgp.encrypt({
				message: openpgp.Message.fromText(plainText),
				publicKeys: publicKeys.concat(this.key.toPublic()),
				privateKeys: this.key
			}))
			.then(armoredText => {
				this._send(channel, this._attachJSON({
					type: CHANNEL_MESSAGE,
					public: true,
					message: armoredText
				}, FILE));
			})
			.catch(err => { this.emit('error', `failed to encrypt: ${plainText}\n${err.stack}`); })
			.finally(resolve);
		});
	}

	messageSigned (channel, plainText) {
		this._publicKeys(channel)
		.then(publicKeys => {
			const temp = [ this.key ];
			return new Promise(resolve => {
				Promise.all(publicKeys.map(key => key.verifyPrimaryUser(temp)))
				.then(bonafides => {
					const signedKeys = [];
					for (let i = 0; i < bonafides.length; i++) {
						if (bonafides[i].find(x => x.valid) != null) {
							signedKeys.push(publicKeys[i]);
						}
					}
					resolve(signedKeys);
				});
			});
		})
		.then(signedKeys => openpgp.encrypt({
			message: openpgp.Message.fromText(plainText),
			publicKeys: signedKeys.concat(this.key.toPublic()),
			privateKeys: this.key
		}))
		.then(armoredText => {
			this._send(channel, this._attachJSON({
				type: CHANNEL_MESSAGE,
				public: false,
				message: armoredText
			}, FILE));
		})
		.catch(err => { this.emit('error', `failed to encrypt: ${plainText}\n${err.stack}`); });
	}

	numberStowaways (channel) {
		return new Promise((resolve, reject) => {
			this._allUsers((err, docs) => {
				if (err != null) {
					reject(err);
				}
				else {
					let res = 0;
					docs.map(x => x.user_id).forEach(id => {
						channel.members.find(user => user.id === id)
						.each(() => {
							res++;
						});
					});
					resolve(res);
				}
			});
		});
	}

	// OK to run before launch
	// can revoke key0 without passphrase
	// assume key1 is decrypted already
	revokeKey (client, key0, key1, revocationCertificate) {
		return new Promise((resolve, reject) => {
			this.db.find({ $or : [
				{ channel_id: { $exists: true } },
				{ revocation_ceritifcate: { $exists: true } }
			] }, async (err, docs) => {
				const channelIds = docs.filter(x => x.channel_id != null).map(x => x.channel_id);
				let revocations = docs.filter(x => x.revocation_certificate != null).map(x => x.revocation_certificate);
				if (err != null) {
					this.emit('error', 'database error in Stowaway.revokeKey()');
					reject(err);
				}
				else if (channelIds.length > 0) { // don't just do it if you know someone else
					let { privateKey: revocation } = await openpgp.revokeKey({
						key: key0,
						revocationCertificate
					});
					revocation = await revocation.signPrimaryUser([ key1 ]);
					this.db.insert({ fingerprint: revocation.getFingerprint(), revocation_certificate: revocation.armor() });
					// TODO uncomment below, comment out above
					// this.revocations.insert({
					// 	fingerprint: revocation.getFingerprint(),
					// 	revocation_certificate: revocation.armor()
					// });
					revocations = await Promise.all(revocations.map(armor => openpgp.readKey({ armoredKey: armor })));
					revocations = await Promise.all(revocations.map(r => r.signPrimaryUser([ key1 ])));
					revocations.push(revocation);
					// const key = await key1.signPrimaryUser(revocations);
					const publicKeyArmored = key1.toPublic().armor();
					const armoredRevocation = revocation.toPublic().armor();
					this.key = key1;
					if (this.oldKeys != null) {
						this.oldKeys.push(revocation);
					}
					Promise.all(channelIds.map(channelId => {
						return new Promise((res, rej) => {
							client.channels.fetch(channelId, false)
							.then(channel => this._send(channel, this._attachJSON({
								type: REVOCATION,
								revocation: armoredRevocation,
								publicKey: publicKeyArmored
							}, FILE)))
							.then(res)
							.catch(rej);
						});
					}))
					.then(() => { resolve(key1); })
					.catch(reject);
					/*
					docs.filter(x => x.channel_id != null).forEach(doc => {
						client.channels.fetch(doc.channel_id, false)
						.then(channel => {
							this._send(channel, this._attachJSON({
								type: REVOCATION,
								revocation: armoredRevocation,
								publicKey: publicKeyArmored
							}, FILE));
						});
					});
					*/
				}
				else {
					this.key = key1;
					resolve(key1);
				}
			});
		});
	}

	signKey (channel, userId) {
		return new Promise(resolve => {
			this._findUser(userId, (err, doc) => {
				if (err != null) {
					this.emit('error', `database error in Stowaway.signKey(), user id argument: ${userId}`);
					resolve();
				}
				else if (doc != null) {
					openpgp.readKey({ armoredKey: doc.public_key })
					.then(publicKey => publicKey.signPrimaryUser([ this.key ]))
					.then(signedKey => this._send(channel, this._attachJSON({
						type: SIGNED_KEY,
						recipient: userId,
						publicKey: signedKey.armor()
					}, FILE)))
					.catch(err => {
						if (err.message === ERR_ARMORED) {
							// TODO
						}
						else {
							// TODO
						}
					})
					.finally(resolve);
				}
				else {
					resolve();
				}
			});
		});
	}

	async signedKey (userId) {
		const publicKey = await this._publicKey(userId, 'Stowaway.signedKey()');
		const bonafides = await publicKey.verifyPrimaryUser([ this.key ]);
		return bonafides.find(x => x.valid) !== undefined;
	}

	_allChannels (callback) {
		this.db.find({ channel_id: { $exists: true } }, callback);
	}

	_allUsers (callback) {
		this.db.find({ user_id: { $exists: true }, public_key: { $exists: true } }, callback);
	}

	_attachJSON (json, name) {
		json.version = this.version;
		return attachJSON(json, name);
	}

	_findChannel (channelId, callback) {
		this.db.findOne({ channel_id: channelId }, callback);
	}

	_findUser (userId, callback) {
		this.db.findOne({ user_id: userId, public_key: { $exists: true } }, callback);
	}

	_publicKey (userId, origin) {
		if (userId === this.id || userId == null) {
			return Promise.resolve(this.key.toPublic());
		}
		else {
			return new Promise((resolve, reject) => {
				this._findUser(userId, (err, doc) => {
					if (err) {
						this.emit('error', `database error in Stowaway._publicKey() user id argument: ${userId}`);
						reject(err);
					}
					else if (doc != null) {
						openpgp.readKey({ armoredKey: doc.public_key })
						.then(resolve)
						.catch(reject);
					}
					else {
						// reject();
						reject(Error(`No entry for userId ${userId}! Called from: ${origin}`));
					}
				});
			});
		}
	}

	_publicKeys (channel) {
		return new Promise(resolve => {
			 Promise.allSettled(channel.members.map(user => {
				return new Promise((res, rej) => {
					this._findUser(user.id, (err, doc) => {
						if (err != null) {
							rej();
						}
						else if (doc != null) {
							res(doc.public_key);
						}
						else {
							rej();
						}
					});
				});
			}))
			.then(values => values.filter(x => x.status === 'fulfilled').map(x => x.value))
			.then(armoredKeys => Promise.all(armoredKeys.map(armoredKey => {
				return openpgp.readKey({ armoredKey });
			})))
			.then(resolve); // think about it
		});
	}

	_send (channel, attachment) {
		return channel.send(this.discordMessage, attachment);
	}

	async _sendHandshake (channel, requestResponse) {
		return this._send(channel, this._attachJSON({
			type: HANDSHAKE,
			respond: requestResponse,
			public_key: this.key.toPublic().armor(),
			revocations: await this._armoredPublicRevocations
		}, FILE));
	}

	_sendKeySignature (channel, userId, armoredPublicKey) {
		this._send(channel, this._attachJSON({
			type: SIGNED_KEY,
			recipient: userId,
			publicKey: armoredPublicKey
		}, FILE));
	}

	_updateLatests (channelId, id, ts) {
		this._findChannel(channelId, (err, doc) => {
			if (err != null) {
				this.emit('error', `database error in SingleStowaway._updateLatests() channel id argument: ${channelId}`);
			}
			else if (doc != null) {
				if (ts > doc.last_seen.ts) {
					this.db.update({ channel_id: channelId }, { $set: { last_seen: { id, ts } } });
				}
			}
		});
	}

	_writeKey (armoredKey) {
		return new Promise((resolve, reject) => {
			fs.writeFile(this.keyFile, armoredKey, 'utf8', err => {
				if (err) {
					reject(Error('Write Error'));
				}
				else {
					resolve();
				}
			});
		});
	}


	//  MESSAGE HANDLING  //

	// AFTER 1.0.0: SESSION SUPPORT
	// NOTE since only guild channel messages get processed you can use message.member to access the guildMember of the sender
	_handleActive (message) {
		this._processChannel(message, () => {
			this._processJSON(message)
			.then(json => {
				if (json.type === CHANNEL_MESSAGE) {
					if (json.message != null && (typeof json.public) === 'boolean') {
						this._channelMessage(json.message, json.public, message);
					}
					else {
						throw Error(`missing keys for channel message in JSON. Keys found:\n${Object.keys(json)}`);
					}
				}
				else if (message.author.id !== this.id) {
					this._nonChannelMessage(json, message, false);
				}
			})
			.catch(err => { this.emit('error', `Error in Stowaway._handleActive()\n${err.stack}`); });
		});
	}

	_handleNotify (message) {
		if (message.author.id !== this.id) {
			this._processChannel(message, () => {
				this._processJSON(message)
				.then(json => { this._nonChannelMessage(json, message, true); })
				.catch(err => { this.emit('error', `Error in Stowaway._handleNotify()\n${err.stack}`); });
			});
		}
	}

	_nonChannelMessage (json, message, notify) {
		switch (json.type) {
			case HANDSHAKE:
				if (json.public_key != null && (typeof json.respond) === 'boolean' && Array.isArray(json.revocations))
				{
					this._handshake(json.public_key, json.respond, json.revocations, message) // may cauase a handhsake
					.then(({ color, text }) => {
						// this.emit('notify', color, text);
						if (notify && color != null && text != null) {
							this.emit('notify', color, text);
						}
					});
				}
				else {
					throw Error(`missing json keys for handshake. Keys found: ${Object.keys(json)}`);
				}
				break;
			case SIGNED_KEY:
				if (json.recipient != null && json.publicKey != null) {
					if (json.recipient === this.id) {
						this._signedKey(json.publicKey, message) // causes handshakes
						.then(text => {
							if (notify && text != null) {
								this.emit('notify', 'blue', text);
							}
						});
					}
				}
				else {
					throw Error('missing json keys for signed key');
				}
				break;
			case REVOCATION:
				if (json.revocation != null && json.publicKey != null) {
					this._revocation(json.revocation, json.publicKey, message.author.id)
					.then(({ valid, reason }) => {
						if (valid) {
							this.emit('revocation', message);
						}
						if (notify) {
							if (valid) {
								this.emit('notify', 'green', `Key revocation from ${message.author.tag}`);
							}
							else if (reason !== 'not needed') {
								this.emit('notify', 'red', `{underline}FRAUDULENT KEY REVOCATION FROM ${message.author.tag}{/underline}\nInvalidating reason: ${reason}`);
							}
						}
					});
				}
				else {
					throw Error('missing json keys for revocation');
				}
			default:
				break;
		}
	}

	_processChannel (message, func) {
		this._findChannel(message.channel.id, (err, doc) => {
			if (err != null) {
				throw Error(`database error in Stowaway._recognizedChannel()\n${err.stack}`);
			}
			else if (doc != null && message.createdTimestamp > doc.handshake.ts) {
				this.emit('timestamp', message.channel.id, message.createdAt, message.id);
				if (message.content != null && message.content.match(STOWAWAY_RGX)) {
					func();
				}
			}
			/* NON
			else {
				throw Error(`No known channel ${message.channel.guild.name} _${message.channel.name} with id ${message.channel.id}`);
			}
			*/
		});
	}

	async _processJSON (message) {
		if (message.editedAt != null) {
			throw Error('Messsage was edited!');
		}
		else {
			const file = getAttachment(message);
			if (file.exists) {
				const attached = await readAttached(file.url);
				try {
					const json = JSON.parse(attached);
					if (json.type != null) {
						return json;
					}
					else {
						throw Error('missing key \'type\' in attached json');
					}
				}
				catch (err) {
					if (err instanceof SyntaxError) {
						this.emit('error', `malformed json:\n${attached}`);
						throw err;
					}
					else {
						throw err;
					}
				}
			}
			else {
				throw Error(`no attached ${FILE}`);
			}
		}
	}

	/*  TYPE HANDLERS  */

	// OK
	_channelMessage (armoredMessage, publicFlag, message) {
		this._publicKey(message.author.id, 'Stowaway._channelMessage()')
		.then(publicKey => {
			this._decrypt(publicKey, armoredMessage, message, publicFlag);
		})
		.catch(err => {
			if(err != null) {
				this.emit('error', `unexpected error in Stowaway._channelMessage(): ${err.stack}`);
			}
			else {
				this.emit('error', 'unexpected error in Stowaway._channelMessage()');
			}
		});
	}

	// OK
	_decrypt (publicKey, armoredMessage, message, publicFlag) {
		openpgp.readMessage({ armoredMessage })
		.then(res => openpgp.decrypt({
			message: res,
			publicKeys: publicKey,
			privateKeys: this.oldKeys.concat(this.key),
		}))
		.then(decrypted => {
			return this._verifyMessage(decrypted, publicKey);
		})
		.then(result => {
			this.emit('channel message', message, result, publicFlag);
			// this.emit('test', `${publicFlag? 'public' : 'signed-only'} message from ${message.author.tag}: (signed: ${result.signed}, verified: ${result.verified}) ${result.plainText}`);
			this._updateLatests(message.channel.id, message.id, message.createdTimestamp);
		})
		.catch(err => {
			if (err.message === ERR_ARMORED) {
				// emit something about misformed armored text
				this.emit('error', `misformed armored message from ${message.author.tag} on ${message.channel.guild.name} _${message.channel.name}`);
			}
			else if (err.message === ERR_DECRYPT) {
				if (publicFlag) {
					// if you're here it's possible you (1) the author doesn't have your public key or (2) author has one of your revoked public keys
					this.emit('decryption failure', message);
					const channelId = message.channel.id;
					this.db.findOne({ channel_id: channelId }, (err, doc) => {
						if (err != null) {
							this.emit('error', `database error in SingleStowaway._decrypt() channel id argument: ${channelId}`);
						}
						else if (doc.decryption_failures == null) {
							this.db.update({ channel_id: channelId }, { $set: { decryption_failrues: [ message.id ] } });
							this._sendHandshake(message.channel, false);
						}
						else if (!doc.decryption_failures.contains(message.id)) {
							this.db.update({ channel_id: channelId }, { $push: { decryption_failures: message.id } });
							this._sendHandshake(message.channel, false);
						}
					});
					this.emit('error', `failed to decrypt a public message from ${message.author.tag} on ${message.channel.guild.name} _${message.channel.name}`);
				}
			}
			else {
				this.emit('error', `unexpected error in Stowaway._decrypt(): ${err.stack}`);
			}
		});
	}

	// OK
	_verifyMessage (decrypted, publicKey) {
		if (decrypted.signatures != null && decrypted.signatures.length > 0) {
			return new Promise(resolve => {
				decrypted.signatures[0].verified
				.then(flag => {
					publicKey.verifyPrimaryUser([ this.key ])
					.then(bonafides => {
						resolve({
							signed: bonafides.find(x => x.valid) != null,
							verified: flag,
							plainText: decrypted.data
						});
					});
				});
			});
		}
		else {
			return new Promise(resolve => {
				publicKey.verifyPrimaryUser([ this.key ])
				.then(bonafides => {
					resolve({
						signed: bonafides.find(x => x.valid) != null,
						verified: false,
						plainText: decrypted.data
					});
				});
			});
		}
	}

	// OK -- improve error handling
	// figure out why linter says this is wrong
	_handshake (armoredKey, plsRespond, revocations, message) {
		return new Promise(resolve => {
			const userId = message.author.id;
			this._findUser(userId, async (err, doc) => {
				if (err) {
					this.emit('error', `database error in Stowaway._handshake() user id argument: ${userId}`);
					resolve('red', `Unexpected database error while processing handshake from ${message.author.tag}`);
				}
				else if (doc == null) {
					try {
						await openpgp.readKey({ armoredKey }); // do this just to check it's armored key is actually a key
						this.db.insert({
							user_id: userId,
							public_key: armoredKey,
							// armor_hash: hash(armoredKey)
						});
						if (plsRespond) {
							await this._sendHandshake(message.channel, false);
						}
						this.emit('handshake', message, true);
						resolve({
							color: 'green',
							text: `New handshake from ${message.member.displayName} on ${message.guild.name} _${message.channel.name}`
						});
					}
					catch (err) {
						this.emit('handshake', message, false);
						if (err != null) {
							this.emit('error', `Error in Stowaway._handshake():\n${err.stack}`);
						}
						else {
							this.emit('error', `Unexpected error in Stowaway._handshake()`);
						}
						resolve({
							color: 'yellow',
							text: `Improper amrmored key in handshake from ${message.author.tag}`
						});
					}
				}
				else {
					try {
						const publicKey = await openpgp.readKey({ armoredKey });
						const savedKey = await openpgp.readKey({ armoredKey: doc.public_key });
						if (publicKey.hasSameFingerprintAs(savedKey)) {
							await savedKey.update(publicKey);
							const armor = savedKey.armor();
							this.db.update({ user_id: message.author.id }, { $set: { public_key: armor } });
							this.emit('key update', message);
							resolve({
								color: 'green',
								text: `Key update from ${message.author.tag}`
							});
						}
						else {
							let revocation;
							for (let i = 0; i < revocations.length; i++) {
								revocation = await openpgp.readKey({ armoredKey: revocations[i] });
								if (revocation.hasSameFingerprintAs(savedKey)) {
									this.db.update({ user_id: message.author.id }, { $set: { public_key: armoredKey } });
									resolve('green', `Key revocation from ${message.author.tag}`);
									this.emit('revocation', message);
									break;
								}
							}
							resolve({});
						}
					}
					catch {
						resolve({
							color: 'yellow',
							text: `Improper armored key in handshake from ${message.author.tag}`
						});
					}
				}
			});
		});
	}

	// not GOOF'D?
	async _signedKey (armoredKey, message) {
		try {
			const publicKey = await openpgp.readKey({ armoredKey });
			const userKey = await this._publicKey(message.author.id, 'Stowaway._signedKey()');
			let bonafides = await publicKey.verifyPrimaryUser([ userKey ]);
			if (bonafides.find(x => x.valid) != null) {
				bonafides = await this.key.verifyPrimaryUser([ userKey ]);
				if (bonafides.find(x => x.valid) == null) {
					await this._updatePrivateKey(publicKey);
					this.emit('signed key', message);
					// this.emit('test', `${message.author.tag} signed your key!`);
					return `${message.author.tag} signed your key!`;
				}
			}
		}
		catch (err) {
			if (err != null && err.message === ERR_ARMORED) {
				// stuff
			}
			else if (err != null) {
				this.emit('error', `unexpected error in Stowaway._signedKey()\n${err.stack}`);
			}
			else if (this.passphrase == null) {
				this.emit('error', 'passphrase not set!');
			}
			else {
				this.emit('error', `unexpected error in Stowaway._signedKey()`);
			}
		}
	}

	// OK -- do error handling
	_updatePrivateKey (publicKey) {
		return new Promise(async (resolve, reject) => {
			await this.key.update(publicKey);
			this._allChannels((err, docs) => {
				if (err != null) {
					reject(err);
				}
				else {
					Promise.all(docs.map(doc => new Promise(resolve => {
						this.client.channels.fetch(doc.channel_id, false)
						.then(channel => this._sendHandshake(channel, false))
						.then(resolve);
					})))
					.then(() => openpgp.encryptKey({ privateKey: this.key, passphrase: this.passphrase }))
					.then(encryptedKey => this._writeKey(encryptedKey.armor()))
					.then(resolve)
					.catch(reject);
				}
			});
		});
	}

	_revocation (armoredRevocation, armoredKey, userId) {
		return new Promise(resolve => {
			Promise.all([ 
				this._publicKey(userId, 'Stowaway._revocation()'),
				openpgp.readKey({ armoredKey }),
				openpgp.readKey({ armoredKey: armoredRevocation }),
			])
			.then(keys => {
				if (keys[0].hasSameFingerprintAs(keys[1])) {
					return { valid: false, reason: 'not needed' };
				}
				else {
					return this._validateRevocation(keys[0], keys[2]);
				}
			})
			.then(({ valid, reason }) => {
				if (valid) {
					this.db.update({ user_id: userId }, { $set: {public_key: armoredKey } });
				}
				resolve({ valid, reason });
			})
			.catch(err => {
				if (err != null) {
					this.emit('error', `error in Stowaway._revocation()\n${err.stack}`);
					resolve({ valid: false, reason: err });
				}
				else {
					this.emit('error', `unknown error in Stowaway._revocation`);
					resolve({ valid: false, reason: 'Unknown error' });
				}
			});
		});
	}

	async _validateRevocation (publicKey, revocation) {
		try {
			await revocation.getRevocationCertificate();
		}
		catch (err) {
			return { valid: false, reason: 'no revocation certificate' };
		}
		if (revocation.hasSameFingerprintAs(publicKey)) {
			return { valid: true };
		}
		else {
			return { valid: false, reason: 'fingerprint mismatch' };
		}
	}

}

module.exports = { Stowaway, Permissions, Messenger };
