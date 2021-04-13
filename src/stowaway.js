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
const KEY_UPDATE = 'key_update';
const REVOCATION = 'revocation';
// TODO session


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
			response.on('data', data => { resolve(data.toString()); });
			response.on('error', err => { reject(err); });
		});
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
	#sendKeyUpdate;

	constructor (db, keyFile, version, comment='') {
		super();
		this.db = db;
		this.keyFile = keyFile;
		this.version = version;
		this.discordMessage = `${STOWAWAY}\nVERSION: ${version}`;
		if (comment.length > 0) {
			this.discordMessage += `\nUser comment: ${comment}`;
		}
	}

	get #armoredPublicRevocations () {
		return new Promise((resolve, reject) => {
			this.#revocations()
			.then(revocations => {
				resolve(revocations.map(x => x.toPublic().armor()));
			})
			.catch(reject);
		});
	}

	get #revocations () {
		return new Promise((resolve, reject) => {
			this.db.find({ revocation_certificate: { $exists: true } }, (err, docs) => {
				if (err != null) {
					reject(err);
				}
				else {
					Promise.all(docs.map(x => openpgp.readKey({ armoredKey: x.revocation })))
					.then(resolve)
					.catch(reject);
				}
			});
		});
	}

	fetchNewer (channel, messageID) {
		return new Promise((resolve, reject) => {
			this.#findChannel(channel.id, (err, doc) => {
				if (err != null) {
					this.emit('error', `database error in Stowaway.fetchNewer() channel_id: ${channel.id}`);
					reject(err);
				}
				if (doc != null) {
					channel.messages.fetch({ after: messageID }, false, false)
					.then(messages => {
						messages.sort((m0, m1) => m0.createdTimestamp - m1.createdTimestamp)
						.each(message => {
							this.#handleMessage(message);
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
			this.#findChannel(channel.id, (err, doc) => {
				if (err != null) {
					this.emit('error', `database error in Stowaway.fetchOlder() channel_id: ${channel.id}`);
					reject(err);
				}
				if (doc != null) {
					channel.messages.fetch({ before: messageID }, false, false)
					.then(messages => {
						messages.sort((m0, m1) => m0.createdTimestamp - m1.createdTimestamp)
						.each(message => {
							this.#handleMessage(message);
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
			this.#findUser(userId, async (err, doc) => {
				if (err != null) {
					this.emit('error', `database error in Stowaway.knownSignatures(), user id argument: ${userId}`);
				}
				else if (doc != null) {
					const publicKey = await openpgp.readKey({ armoredKey: doc.public_key });
					const { publicKeys, userIds } = await new Promise(res => {
						this.#allUsers((error, docs) => {
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

	launch (client, key) {
		this.id = client.user.id;
		this.key = key;
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
			else {
				this.#handleMessage(message);
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
		this.#sendKeyUpdate = armoredPublicKey => {
			const updateJSON = {
				type: KEY_UPDATE,
				publicKey: armoredPublicKey
			};
			this.#allChannels((err, docs) => {
				if (err != null) {
					this.emit('error', 'database error in Stowaway.#sendKeyUpdate()');
				}
				else {
					docs.forEach(doc => {
						client.channels.fetch(doc.channel_id, false)
						.then(channel => {
							this.#send(channel, updateJSON);
						})
						.catch(err => {
							this.emit('error', `unexpected error fetching channel with id: ${doc.channel_id} in _sendKeyUpdate():  ${err}`);
						});
					});
				}
			});
		};
		client.user.setPresence({
			activity: {
				type: 'LISTENING',
				name: ' dms for "about STOWAWAY"'
			},
			status: 'online'
		});
		// remove deleted channels from database (channels model checks independently)
		this.db.find({ channel_id: { $exists: true } }, (err, docs) => {
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
	}

	// handshakes channel if not in database
	// returns a promise so you can enable autoscroll after loading
	loadChannel (channel) {
		return new Promise(resolve => {
			this.#findChannel(channel.id, (err, doc) => {
				if (err != null) {
					this.emit('error', `database error in Stowaway.loadChannel(), channel id argument: ${channel.id}`);
				}
				else if (doc == null) { // handshake channel
					this.#sendHandshake(channel, true)
					.then(message => {
						this.emit('debug', `${message.createdTimestamp}`);
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
								this.emit('handshake', true, message);
								this.db.update({ last_channel: { $exists: true } }, { last_channel: channel.id }, { upsert: true });
								this.emit('read channel', channel);
							}
						});
					})
					.catch(err => {
						this.emit('error', 'unexpected error in Stowaway.loadChannel() from Stowaway.#sendHandshake()');
					})
					.finally(resolve);
				}
				else { // load messages around the last seen message
					channel.messages.fetch(doc.handshake.id)
					.then(message => {
						this.emit('handshake', true, message);
						return channel.messages.fetch({ around: doc.last_seen.id }, false, false);
					})
					.then(messages => {
						messages.sort((m0, m1) => m0.createdTimestamp - m1.createdTimestamp)
						.each(message => { this.#handleMessage(message); });
						this.db.update({ last_channel: { $exists: true } }, { last_channel: channel.id }, { upsert: true });
							this.emit('read channel', channel);
					})
					.catch(err => {
						this.emit('error', `unexpected error in Stowaway.loadChannel() ${err}`);
					})
					.finally(resolve);
				}
			});
		});
	}

	messagePublic (channel, plainText) {
		this.#publicKeys(channel)
		.then(publicKeys => openpgp.encrypt({
			message: openpgp.Message.fromText(plainText),
			publicKeys: publicKeys.concat(this.key.toPublic()),
			privateKeys: this.key
		}))
		.then(armoredText => {
			this.#send(channel, this.#attachJSON({
				type: CHANNEL_MESSAGE,
				public: true,
				encrypted: armoredText
			}, FILE));
		})
		.catch(err => { this.emit('error', `failed to encrypt: ${plainText}\n${err}`); });
	}

	messageSigned (channel, plainText) {
		this.#publicKeys(channel)
		.then(publicKeys => {
			const temp = [ this.key ];
			return new Promise(resolve => {
				Promise.all(publicKeys.map(key => key.verifyPrimaryUser(temp)))
				.then(bonafides => {
					const signedKeys = [];
					for (let i = 0; i < bonafides.length; i++) {
						if (bonafides[i].valid) {
							bonafides.push(signedKeys[i]);
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
			this.#send(channel, this.#attachJSON({
				type: CHANNEL_MESSAGE,
				public: false,
				encrypted: armoredText
			}, FILE));
		})
		.catch(err => { this.emit('error', `failed to encrypt: ${plainText}\n${err}`); });
	}

	numberStowaways (channel) {
		return new Promise((resolve, reject) => {
			this.#allUsers((err, docs) => {
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
				{ user_id: { $exists: true } }
			] }, async (err, docs) => {
				if (err != null) {
					this.emit('error', 'database error in Stowaway.revokeKey()');
					reject(err);
				}
				else if (docs.length > 0) { // don't just do it if you know someone else
					let { privateKey: revocation } = await openpgp.revokeKey({
						key: key0,
						revocationCertificate
					});
					let revocations = await this.#revocations();
					revocation = await revocation.signPrimaryUser(revocations.concat(key1));
					this.db.insert({ revocation_certificate: revocation.armor() });
					revocations = revocation.concat(revocations);
					const key = await key1.signPrimaryUser(revocations);
					const publicKeyArmored = key.toPublic().armor();
					docs.filter(x => x.channel_id != null).forEach(doc => {
						client.channels.fetch(doc.channel_id, false)
						.then(channel => {
							this.#send(channel, this.#attachJSON({
								type: HANDSHAKE,
								respond: false,
								publicKey: publicKeyArmored,
								revocations: revocations.map(x => x.toPublic().armor())
							}, FILE));
						});
					});
					resolve(key);
				}
				else {
					resolve(key1);
				}
			});
		});
	}

	signKey (channel, userId) {
		this.#findUser(userId, (err, doc) => {
			if (err != null) {
				this.emit('error', `database error in Stowaway.signKey(), user id argument: ${userId}`);
			}
			else if (doc != null) {
				openpgp.readKey({ armoredKey: doc.public_key })
				.then(publicKey => publicKey.signPrimaryUser([ this.key ]))
				.then(signedKey => this.#send(channel, this.#attachJSON({
					type: SIGNED_KEY,
					recipient: userId,
					publicKey: signedKey
				}, FILE)))
				.catch(err => {
					if (err.message === ERR_ARMORED) {
						// TODO
					}
					else {
						// TODO
					}
				});
			}
		});
	}

	#allChannels (callback) {
		this.db.find({ channel_id: { $exists: true } }, callback);
	}

	#allUsers (callback) {
		this.db.find({ user_id: { $exists: true }, public_key: { $exists: true } }, callback);
	}

	#attachJSON (json, name) {
		json.version = this.version;
		return attachJSON(json, name);
	}

	#findChannel (channelId, callback) {
		this.db.findOne({ channel_id: channelId }, callback);
	}

	#findUser (userId, callback) {
		this.db.findOne({ user_id: userId, public_key: { $exists: true } }, callback);
	}

	#publicKey (userId) {
		if (userId === this.id) {
			return Promise.resolve(this.key.toPublic());
		}
		else {
			return new Promise((resolve, reject) => {
				this.findUser(userId, (err, doc) => {
					if (err) {
						this.emit('error', `database error in Stowaway.#publicKey() user id argument: ${userId}`);
						reject();
					}
					else if (doc != null) {
						openpgp.readKey({ armoredKey: doc.public_key })
						.then(resolve);
					}
					reject();
				});
			});
		}
	}

	#publicKeys (channel) {
		return new Promise(resolve => {
			 Promise.allSettled(channel.members.map(user => {
				return new Promise((res, rej) => {
					this.findUser(user.id, (err, doc) => {
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

	#send (channel, attachment) {
		return channel.send(this.discordMessage, attachment);
	}

	async #sendHandshake (channel, requestResponse) {
		return this.#send(channel, this.#attachJSON({
			type: HANDSHAKE,
			respond: requestResponse,
			public_key: this.key.toPublic().armor(),
			revocations: await this.#armoredPublicRevocations
		}, FILE));
	}

	#sendKeySignature (channel, userId, armoredPublicKey) {
		this.#send(channel, this.#attachJSON({
			type: SIGNED_KEY,
			recipient: userId,
			publicKey: armoredPublicKey
		}, FILE));
	}

	#updateLatests (channelId, id, ts) {
		this.#findChannel(channelId, (err, doc) => {
			if (err != null) {
				this.emit('error', `database error in SingleStowaway.#updateLatests() channel id argument: ${channelId}`);
			}
			else if (doc != null) {
				if (ts > doc.last_seen.ts) {
					this.db.update({ channel_id: channelId }, { $set: { last_seen: { id, ts } } });
				}
			}
		});
	}

	#writeKey (armoredKey) {
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

	// AFTER 1.0.0: SESSION SUPPORT
	// NOTE since only guild channel messages get processed you can use message.member to access the guildMember of the sender
	#handleMessage (message) {
		this.#findChannel(message.channel.id, async (err, doc) => {
			if (err != null) {
				this.emit('error', `database error in Stowaway.#handleMessage().  Channel id argument: ${message.channel.id}`);
			}
			else if (doc != null && message.createdTimestamp >= doc.handshake.ts) {
				this.emit('timestamp', message.channel.id, message.createdAt, message.id);
				if (STOWAWAY_RGX.test(message.content) && message.attachments.size > 0) {
					const file = getAttachment(message);
					if (file.exists) {
						let data;
						try {
							data = JSON.parse(await readAttached(file.url));
						}
						catch (err) {
							this.emit('error', `malformed json:\n${file.url}`);
							return;
						}
						this.emit('debug', data.type);
						if (data.type == null) {
							this.emit('error', 'missing type key in json');
							return;
						}
						else if (data.type === CHANNEL_MESSAGE) {
							this.emit('debug', `channel message on ${message.channel.name} at ${message.createdTimestamp}`);
							if (data.encrypted != null && (typeof data.public) === 'boolean') {
								this.#channelMessage(data.encrypted, data.public, message); // may cause a handshake
							}
							else {
								this.emit('error', 'missing json keys for channel message');
							}
						}
						else if (message.author.id !== this.id) {
							switch (data.type) {
								case HANDSHAKE:
									if (data.publicKey != null && data.respond != null
										&& (typeof data.respond) === 'boolean'
										&& data.revocations != null && Array.isArray(data.revocations))
									{
										this.#handshake(data.publicKey, data.respond, data.revocations, message); // may cauase a handhsake
									}
									else {
										this.emit('error', 'missing json keys for handshake');
									}
									break;
								case SIGNED_KEY:
									if (data.recipient != null && data.publicKey != null) {
										if (data.recipient === this.id) {
											this.#signedKey(data.publicKey, message.author); // causes key update
										}
									}
									else {
										this.emit('error', 'missing json keys for signed key');
									}
									break;
								default:
									break;
							}
						}
					}
					else {
						this.emit('error', 'failed to find STOWAWAY.json');
					}
				}
				else {
					this.emit('error', 'NO ATTACHMENT');
				}
			}
		});
	}


	/*  MESSAGE HANDLERS  */

	// OK
	#channelMessage (armoredMessage, publicFlag, message) {
		this.emit('debug', `Stowaway.#channelMessage() public: ${publicFlag}`);
		this.#publicKey(message.author.id)
		.then(publicKey => {
			this.emit('debug', `${publicKey}`);
			if (!publicFlag) {
				this.key.verifyPrimaryUser([ publicKey ])
				.then(bonafides => {
					if (bonafides.find(x => x.valid) !== undefined) {
						this.#decrypt(publicKey, armoredMessage, message, publicFlag);
					}
				});
			}
			else {
				this.#decrypt(publicKey, armoredMessage, message, publicFlag);
			}
		})
		.catch(err => {
			this.emit('error', `unexpected error in Stowaway.#channelMessage(): ${err}`);
		});
	}

	// OK
	#decrypt (publicKey, armoredMessage, message, publicFlag) {
		openpgp.readMessage({ armoredMessage })
		.then(res => openpgp.decrypt({
			message: res,
			publicKeys: publicKey,
			privateKeys: this.key,
		}))
		.then(decrypted => this.#verifyMessage(decrypted, publicKey))
		.then(result => {
			this.emit('channel message', message, result);
			this.#updateLatests(message.channel.id, message.id, message.createdTimestamp);
		})
		.catch(err => {
			if (err.message === ERR_ARMORED) {
				// emit something about misformed armored text
			}
			else if (err.message === ERR_DECRYPT && publicFlag) {
				// if you're here it's possible you (1) the author doesn't have your public key or (2) author has one of your revoked public keys
				this.emit('decryption failure', message);
				this.#sendHandshake(message.channel, false);
			}
			else {
				this.emit('error', `unexpected error in Stowaway.#decrypt(): ${err}`);
			}
		});
	}

	// OK
	#verifyMessage (decrypted, publicKey) {
		if (decrypted.signatures != null && decrypted.signatures.length > 0) {
			return new Promise(resolve => {
				decrypted.signatures[0].verified
				.then(flag => {
					publicKey.verifyPrimaryUser([ this.key ])
					.then(bonafides => {
						resolve({
							signed: bonafides.find(x => x.valid) !== undefined,
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
						signed: bonafides.find(x => x.valid) !== undefined,
						verified: false,
						plainText: decrypted.data
					});
				});
			});
		}
	}

	// OK -- improve error handling
	// figure out why linter says this is wrong
	#handshake (armoredKey, plsRespond, revocations, message) {
		this.#findUser(message.author.id, (err, doc) => {
			if (err) {
				this.emit('error', `database error in Stowaway.#handshake() user id argument: ${message.author.id}`);
			}
			else if (doc == null) {
				openpgp.readKey({ armoredKey }) // do this just to check it's armored key is actually a key
				.then(() => {
					this.db.insert({ user_id: message.author.id, public_key: armoredKey });
					if (plsRespond) {
						this.#sendHandshake(message.channel, HANDSHAKE);
					}
					this.emit('handshake', true, message);
				})
				.catch(() => {
					this.emit('handshake', false, message);
				});
			}
			else {
				openpgp.readKey({ armoredKey })
				.then(publicKey => {
					openpgp.readKey({ armoredKey: doc.public_key })
					.then(savedKey => {
						if (publicKey.hasSameFingerprintAs(savedKey)) { // update currently saved key
							savedKey.update(publicKey)
							.then(() => {
								this.db.update({ user_id: message.author.id }, { public_key: savedKey.armor() });
							});
						}
						else { // attempt to revoke current key
							// check the revocations for a key fingerprint that matches your saved key
							Promise.all(revocations.map(revocation => openpgp.readKey({ armoredKey: revocation })))
							.then(revokingKeys => {
								const revokingKey = revokingKeys.find(x => savedKey.hasSameFingerprintAs(x));
								return this.#revocation(revokingKey, savedKey, publicKey);
							})
							.then(result => {
								if (result.valid) {
									this.db.update({ user_id: message.author.id }, { public_key: armoredKey });
									this.emit('handshake', true, message);
								}
								else {
									this.emit('handshake', false, message);
								}
							});
						}
					});
				});
			}
		});
	}

	// OK -- add proper emissions & error handling
	#signedKey (armoredKey, message) {
		openpgp.readKey({ armoredKey })
		.then(async publicKey => {
			const userKey = await this.#publicKey(message.author.id);
			let bonafides = await publicKey.verifyPrimaryUser([ userKey ]);
			let res = bonafides.find(x => x.valid);
			if (res != null && res.valid) {
				bonafides = await this.key.verifyPrimaryUser([ userKey ])
				res = bonafides.find(x => x.valid);
				if (res == null || !res.valid) {
					await this.#updatePrivateKey(publicKey);
					this.emit('signed key', message);
				}
			}
		})
		.catch(err => {
			if (err.message === ERR_ARMORED) {
				// stuff
			}
			else {
				this.emit('error', `unexpected error in Stowaway.#signedKey(): ${err}`);
			}
		});
	}

	// OK -- do error handling
	#updatePrivateKey (publicKey) {
		return new Promise(async (resolve, reject) => {
			await this.key.update(publicKey)
			this.#allChannels((err, docs) => {
				if (err != null) {
					reject(err);
				}
				else {
					Promise.all(docs.map(doc => new Promise(resolve => {
						this.client.channels.fetch(doc.channel_id, false)
						.then(channel => this.#sendHandshake(channel, false))
						.then(resolve);
					})))
					.then(() => {
						this.#writeKey(this.key.armor())
					})
					.then(resolve)
					.catch(reject);
				}
			});
		});
	}

	async #revocation (revocation, publicKey0, publicKey1) {
		try {
			await revocation.getRevocationCertificate();
		}
		catch (err) {
			return { valid: false, reason: 'no revocation certificate' };
		}
		if (publicKey0.hasSameFingerprintsAs(revocation)) {
			const res = await revocation.verifyPrimaryUser([ publicKey0, publicKey1 ]);
			if (res.filter(x => x.valid) === 2 && (await publicKey1.verifyPrimaryUser([ revocation ]))[0].valid) {
				return { valid: true, publicKey: publicKey1 };
			}
			else {
				return { valid: false, reason: 'invalid signatures' };
			}
		}
		else {
			return { valid: false, reason: 'fingerprint mismatch' };
		}
	}

}

module.exports = { Stowaway, Permissions, Messenger };
