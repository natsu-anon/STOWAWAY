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

// idk what im hashing: user id & fingerprints are all public knowledge
function hash (input) {
	return crypto.createHash('sha224').update(input).digest('base64');
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
		this.discordMessage = `${STOWAWAY}\nVERSION: ${version}`;
		if (comment.length > 0) {
			this.discordMessage += `\nUser comment: ${comment}`;
		}
	}

	get #revocations () {
		return new Promise((resolve, reject) => {
			this.db.find({ revocation: { $exists: true } }, (err, docs) => {
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

	get #armoredPublicRevocations () {
		return new Promise((resolve, reject) => {
			this.db.find({ revocation: { $exists: true } }, (err, docs) => {
				if (err != null) {
					reject(err);
				}
				else {
					Promise.all(docs.map(x => openpgp.readKey({ armoredKey: x.revocation })))
					.then(revokingKeys => {
						resolve(revokingKeys.map(x => x.toPublic().armor()));
					})
					.catch(reject);
				}
			});
		});
	}

	launch (client, key) {
		this.id = client.user.id;
		this.key = key;
		this.fingerprint = key.getFingerprint();
		client.on('message', message => {
			if (message.channel.type === 'dm') {
				if (message.content.toLowerCase() === 'about') {
					let about = `Hello ${message.author.username}, I'm a STOWAWAY bot!`;
					about += 'That means I allow my user to send & receive encrypted messages with ease.  ';
					about += 'You can learn more about STOWAWAY and get your own at: https://github.com/natsu-anon/STOWAWAY';
					message.reply(about);
				}
				else {
					message.reply("dm me 'about' to learn about what I do");
				}
			}
			else  {
				this.#handleMessage(message);
			}
		});
		client.on('channelDelete', channel => {
			// TODO remove channel from db if in db
		});
		client.on('channelUpdate', (ch0, ch1) => {
			// TODO set channel id of ch0 matches
		});
		this.#sendKeyUpdate = armoredPublicKey => {
			const updateJSON = {
				type: KEY_UPDATE,
				publicKey: armoredPublicKey
			};
			this.#allChannels((err, docs) => {
				if (err != null) {
					this.emit('database error', 'Error while accsesing database in Stowaway.#sendKeyUpdate()');
				}
				else {
					docs.forEach(doc => {
						client.channels.fetch(doc.channel_id, false)
						.then(channel => {
							this.#send(channel, updateJSON);
						})
						.catch(err => {
							this.emit('unexpected error', `error fetching channel with id: ${doc.channel_id} in _sendKeyUpdate():  ${err}`);
						});
					});
				}
			});
		};
		client.user.setPresence({
			activity: {
				type: 'LISTENING',
				name: ' dms for "about"'
			},
			status: 'online'
		});
	}

	fetchOlder (channel, messageID) {
		return new Promise((resolve, reject) => {
			this.#findChannel(channel.id, (err, doc) => {
				if (err != null) {
					this.emit('database error', `Stowaway.fetchOlder() channel_id: ${channel.id}`);
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

	fetchNewer (channel, messageID) {
		return new Promise((resolve, reject) => {
			this.#findChannel(channel.id, (err, doc) => {
				if (err != null) {
					this.emit('database error', `Stowaway.fetchNewer() channel_id: ${channel.id}`);
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

	// handshakes channel if not in database
	// returns a promise so you can enable autoscroll after loading
	loadChannel (channel) {
		return new Promise((resolve, reject) => {
			this.#findChannel(channel.id, (err, doc) => {
				if (err != null) {
					this.emit('database error', `Stowaway.loadChannel(), channel id argument: ${channel.id}`);
					reject(err);
				}
				else if (doc == null) { // handshake channel
					this.#sendHandshake(channel, true)
					.then(message => {
						this.db.insert({
							channel_id: channel.id,
							handshake_id: message.id,
							handshake_ts: message.createdTimestsamp,
							last_id: message.id,
							last_ts: message.createdTimestamp,
						}, () => {
							this.emit('handshake channel', channel.guild.id, channel.id);
							this.emit('handshake', channel.id, message.createdTimestamp, message.createdAt, message.author);
							this.db.update({ last_channel: { $exists: true }}, { last_channel: channel.id }, { upsert: true });
							resolve();
						});
					})
					.catch(reject);
				}
				else { // load messages around the last seen message
					channel.messages.fetch(doc.handshake)
					.then(message => {
						this.emit('handshake', channel.id, message.createdTimestamp, message.createdAt, message.author);
						return channel.messages.fetch({ around: doc.last_id }, false, false);
					})
					.then(messages => {
						messages.sort((m0, m1) => m0.createdTimestamp - m1.createdTimestamp)
						.each(message => { this.#handleMessage(message); });
						this.db.update({ last_channel: { $exists: true }}, { last_channel: channel.id }, { upsert: true });
						resolve();
					})
					.catch(reject);
				}
			});
		});
	}

	// OK to run before launch
	// can revoke key0 without passphrase
	// assume key1 is decrypted already
	async revokeKey (client, key0, key1, revocationCertificate) {
		let { privateKey: revocation } = await openpgp.revokeKey({
			key0,
			revocationCertificate
		});
		const revocations = await this.#revocations();
		revocation = await revocation.signPrimaryUser(revocations.concat(key1));
		this.db.insert({ revocation: revocation.armor() });
		const key = key1.signPrimaryUser(revocations.concat(revocation));
		this.#allChannels((err, docs) => {
			if (err) {
				this.emit('database error', 'Stowaway.revokeKey()');
			}
			else {
				const publicRevocationArmored = revocation.toPublic().armor();
				const publicKeyArmored = key.toPublic().armor();
				docs.forEach(doc => {
					client.channels.fetch(doc.channel_id, false)
					.then(channel => {
						this.#send(channel, attachJSON({
							type: REVOCATION,
							revocation: publicRevocationArmored,
							publicKey: publicKeyArmored
						}));
					});
				});
			}
		});
	}

	signKey (channel, userId) {
		this.#findUser(userId, (err, doc) => {
			if (err != null) {
				this.emit('database error', `SingleStowaway.signKey(), user id argument: ${userId}`);
			}
			else if (doc != null) {
				openpgp.readKey({ armoredKey: doc.public_key })
				.then(publicKey => {
					return publicKey.signPrimaryUser([ this.key ]);
				})
				.then(signedKey => {
					return this.#send(channel, attachJSON({
						type: SIGNED_KEY,
						recipient: userId,
						publicKey: signedKey
					}));
				})
				.catch(err => {
					if (err.message === ERR_ARMORED) {
					}
					else {
					}
				});
			}
		});
	}

	messagePublic (channel, plainText) {
		this.#publicKeys(channel)
		.then(publicKeys => {
			return openpgp.encrypt({
				message: openpgp.Message.fromText(plainText),
				publicKeys: publicKeys.concat(this.key.toPublic()),
				privateKeys: this.key
			});
		})
		.then(armoredText => {
			this.#send(channel, attachJSON({
				type: CHANNEL_MESSAGE,
				public: true,
				encrypted: armoredText
			}));
		})
		.catch(err => { this.emit('failed encrypt', plainText, err); });
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
		.then(signedKeys => {
			return openpgp.encrypt({
				message: openpgp.Message.fromText(plainText),
				publicKeys: signedKeys.concat(this.key.toPublic()),
				privateKeys: this.key
			});
		})
		.then(armoredText => {
			this.#send(channel, attachJSON({
				type: CHANNEL_MESSAGE,
				public: false,
				encrypted: armoredText
			}));
		})
		.catch(err => { this.emit('failed encrypt', plainText, err); });
	}

	knownSignatures (userId) {
		return new Promise((resolve, reject) => {
			this.#findUser(userId, async (err, doc) => {
				if (err != null) {
					this.emit('database error', `SingleStowaway.knownSignatures(), user id argument: ${userId}`);
				}
				else if (doc != null) {
					const publicKey = await openpgp.readKey({ armoredKey: doc.public_key });
					const { publicKeys, userIds } = await new Promise(res => {
						this.#allUsers((error, docs) => {
							if (error != null) {
								this.emit('database error', 'SingleStowaway.knownSignatures()');
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

	#allChannels (callback) {
		this.db.find({ channel_id: { $exists: true }, handshake_id: { $exists: true } }, callback);
	}

	#allUsers (callback) {
		this.db.find({ user_id: { $exists: true }, public_key: { $exists: true } }, callback);
	}

	#findChannel (channelId, callback) {
		this.db.findOne({ channel_id: channelId, handshake_id: { $exists: true } }, callback);
	}

	#findUser (userId, callback) {
		this.db.findOne({ user_id: userId, public_key: { $exists: true } }, callback);
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
			.then(values => {
				return values.filter(x => x.status === 'fulfilled').map(x => x.value);
			})
			.then(armoredKeys => {
				return Promise.all(armoredKeys.map(armoredKey => {
					return openpgp.readKey({ armoredKey });
				}));
			})
			.then(resolve); // think about it
		});
	}

	#publicKey (userId) {
		return new Promise((resolve, reject) => {
			this.findUser(userId, (err, doc) => {
				if (err) {
					this.emit('database error', `Stowaway.#publicKey() user id argument: ${userId}`);
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

	#send (channel, attachment) {
		return channel.send(this.discordMessage, attachment);
	}

	async #sendHandshake (channel, requestResponse) {
		return this.#send(channel, attachJSON({
			type: HANDSHAKE,
			respond: requestResponse,
			public_key: this.key.toPublic().armor(),
			revocations: await this.#armoredPublicRevocations
		}, FILE));
	}

	#sendKeySignature (channel, userId, armoredPublicKey) {
		this.#send(channel, attachJSON({
			type: SIGNED_KEY,
			recipient: userId,
			publicKey: armoredPublicKey
		}));
	}

	#updateLatests (channelId, id, ts) {
		this.#findChannel(channelId, (err, doc) => {
			if (err != null) {
				this.emit('database error', `SingleStowaway.#updateLatests() channel id argument: ${channelId}`);
			}
			else if (doc != null) {
				if (ts > doc.last_ts) {
					this.db.update({ channel_id: channelId, handshake_id: { $exists: true } }, { $set: { last_id: id, last_ts: ts } });
				}
			}
		});
	}

	// AFTER 1.0.0: SESSION SUPPORT
	// NOTE since only guild channel messages get processed you can use message.member to access the guildMember of the sender
	#handleMessage (message) {
		this.#findChannel(message.channel.id, (err, doc) => {
			if (err != null) {
				this.emit('database error', `Error while accessing database in Stowaway.#handleMessage().  Channel id argument: ${message.channel.id}`);
			}
			else if (doc != null && message.createdTimestamp >= doc.handshake_ts) {
				this.emit('timestamp', message.channel.id, message.createdAt, message.id);
				if (STOWAWAY_RGX.test(message.content) && message.attachments.size > 0) {
					const file = getAttachment(message);
					if (file.exists) {
						let data;
						try {
							data = JSON.parse(readAttached(file.url));
						}
						catch (err) {
							// emit something about malformed JSON
							return;
						}
						if (data.type == null) {
							// emit something about missing type
							return;
						}
						else if (data.type === CHANNEL_MESSAGE) {
							if (data.encrypted != null && data.level != null && (typeof data.public) === 'boolean') {
								this.#channelMessage(data.encrypted, data.public, message); // may cause a key provenance
							}
							else {
								// emit something about no encrypted field
							}
						}
						else if (message.author.id !== this.id) {
							switch (data.type) {
								case HANDSHAKE:
									if (data.publicKey != null && data.respond != null
										&& (typeof data.respond) === 'boolean'
										&& data.revocations != null && data.revocations.isArray())
									{
										this.#handshake(data.publicKey, data.respond, data.revocations, message); // may cauase a handhsake
									}
									else {
										// emit something about no publicKey field
									}
									break;
								case SIGNED_KEY:
									if (data.recipient != null && data.publicKey != null) {
										if (data.recipient === this.id) {
											this.#signedKey(data.publicKey, message.author); // causes key update
										}
										// o.w. ignore
									}
									else {
										// emit something about missing recipient and/or publicKey
									}
									break;
								case KEY_UPDATE:
									if (data.publicKey != null) {
										this.#keyUpdate(data.publicKey, message);
									}
									else {
										// emit something about no publicKey field
									}
									break;
								case REVOCATION:
									if (data.revocation != null && data.publicKey != null) {
										this.#keyRevocation(data.revocation, data.publicKey, message); // force the user if to trust the revocation
									}
									else {
										// emit something about missing fields
									}
									break;

								default:
									// emit something about unrecognized type from message.author.id on channel
									break;
							}
						}
						// else YOU sent an unrecognized type -- don't emit anything just smdh
					}
					else {
						// emit something saying failed to find 'STOWAWAY.json'
					}
				}
				else {
					// emit something saying no attachment
				}
			}
		});
	}

	// OK
	#channelMessage (armoredMessage, publicFlag, message) {
		this.#publicKey(message.user.id)
		.then(publicKey => {
			if (!publicFlag) {
				this.key.verifyPrimaryUser([ publicKey ])
				.then(bonafides => {
					if (bonafides.find(x => x.valid) !== undefined) {
						this.#decrypt(publicKey, armoredMessage, message);
					}
				});
			}
			else {
				this.#decrypt(publicKey, armoredMessage, message);
			}
		})
		.catch(err => {
			if (err != null) {
				this.#sendHandshake(message.channel, true);
			}
		});
	}

	// OK
	#decrypt (publicKey, armoredMessage, message) {
		openpgp.readMessage({ armoredMessage })
		.then(message => {
			return openpgp.decrypt({
				message: message,
				publicKeys: publicKey,
				privateKey: [ this.key ].concat(this.oldKeys)
			});
		})
		.then(decrypted => {
			return this.#verifyMessage(decrypted, publicKey);
		})
		.then(result => {
			this.emit('channel message', message, result);
			this.#updateLatests(message.channel.id, message.id, message.createdTimestamp);
		})
		.catch(err => {
			if (err.message === ERR_ARMORED) {
				// emit something about misformed armored text
			}
			else if (err.message === ERR_DECRYPT) {
				// if you're here it's possible you (1) the author doesn't have your public key or (2) author has one of your revoked public keys
				this.emit('decryption failure', message);
			}
			else {
				this.emit('unexpected error', `error in Stowaway.#message(): ${err}`);
			}
		});
	}

	// OK
	#verifyMessage (decrypted, publicKey) {
		if (decrypted.signatures.length > 0) {
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
		new Promise((resolve, reject) => {
			this.#findUser(message.author.id, (err, doc) => {
				if (err) {
					this.emit('database error', `Stowaway.#handshake() user id argument: ${message.author.id}`);
				}
				else if (doc == null) {
					openpgp.readKey({ armoredKey }) // do this just to check it's armored key is actually a key
					.then(_ => {
						this.db.insert({ user_id: message.author.id, public_key: armoredKey });
						if (plsRespond) {
							this.#sendHandshake(message.channel, HANDSHAKE);
						}
						resolve(true);
					})
					.catch(reject);
				}
				else {
					openpgp.readKey({ armoredKey })
					.then(publicKey => {
						openpgp.readKey({ armoredKey: doc.public_key })
						.then(savedKey => {
							if (!publicKey.hasSameFingerprintAs(savedKey)) {
								// check the revocations for a key fingerprint that matches your saved key
								Promise.all(revocations.map(revocation => {
									return openpgp.readKey({ armoredKey: revocation });
								}))
								.then(revokingKeys => {
									const revokingKey = revokingKeys.find(x => savedKey.hasSameFingerprintAs(x));
									 return this.#revocation(revokingKey, savedKey, publicKey);
								})
								.then(result => {
									if (result.valid) {
										this.db.update({ user_id: message.author.id }, { public_key: armoredKey });
										resolve(true);
									}
									else {
										reject();
									}
								});
							}
							else {
								resolve(false);
							}
						});
					})
					.catch(reject);
				}
			});
		})
		.then(flag => {
			if (flag) {
				this.emit('handshake', true, message);
			}
		})
		.catch(err => { this.emit('handshake', false, message); });
	}

	// OK -- add proper emissions & error handling
	#signedKey (armoredKey, message) {
		openpgp.readKey({ armoredKey })
		.then(publicKey => {
			this.#publicKey(message.author.id)
			.then(userKey => {
				return publicKey.verifyPrimaryUser([ userKey ]);
			})
			.then(bonafides => {
				return bonafides.find(x => x.valid);
			})
			.then(res => {
				if (res != null && res.valid) {
					this.#updatePrivateKey(publicKey, sender);
					this.emit('signed key', message);
				}
				else {
					// emit something about lack of expected key signature so no update
				}
			})
			.catch(err => { throw err; });
		})
		.catch(err => {
			if (err.message === ERR_ARMORED) {
				// stuff
			}
			else {
				this.emit('unexpected error', `error in Stowaway.#signedKey(): ${err}`);
			}
		});
	}

	// OK -- do error handling
	#updatePrivateKey (publicKey, sender) {
		this.key.update(publicKey)
		.then(() => {
			return this.#writeKey(this.key.armor());
		})
		.then(() => {
			this.#sendKeyUpdate(this.key.toPublic().armor());
		})
		.catch(err => {
			if (err.message === ERR_UPDATE) {
				// mismatched fingerprints -- rat out sender
			}
			else if (err.message === ERR_WRITE) {
				this.emit('write error', `write error in Stowaway.#updatePrivateKey(), keyfile: ${this.keyFile}`);
			}
			else {
				// unexpected error
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

	// OK -- do error handling
	#keyUpdate (armoredKey, message) {
		openpgp.readKey({ armoredKey })
		.then(publicKey1 => {
			this.#findUser(message.author.id, (err, doc) => {
				if (err) {
					this.emit('database error', `Stowaway.#keyUpdate(), userId: ${userId}`);
				}
				if (doc != null) {
					openpgp.readKey({ armoredKey: doc.public_key })
					.then(publicKey0 => {
						publicKey0.update(publicKey1)
						.then(() => {
							this.db.update({ user_id: message.author.id }, { $set: { public_key: publicKey0.armor() } });
							this.emit('key update', message);
						})
						.catch(err => { throw err; });
					})
					.catch(err => { throw err; });
				}
				else {
					// o.w. you don't recognize userId
				}
			});
		})
		.catch(err => {
			if (err.message === ERR_ARMORED) {
				// TODO
			}
			else if (err.message === ERR_UPDATE) {
				// TODO
			}
			else {
				// TODO
			}
		});
	}


	#keyRevocation (armoredRevocation, armoredPublicKey, message) {
		this.#findUser(message.author.id, (err, doc) => {
			if (err != null) {
				this.emit('database error', `Stowaway.#keyRevocation() user id argument: ${user.id}`);
			}
			else if (doc != null) {
				Promise.all([
					openpgp.readKey({ armoredKey: armoredRevocation }),
					openpgp.readKey({ armoredKey: doc.public_key }),
					openpgp.readKey({ armoredKey: armoredPublicKey })
				])
				.then(keys => {
					if (!keys[1].hasSameFingerprintAs(keys[2])) {
						return this.#revocation(keys[0], keys[1], keys[2]);
					}
				})
				.then(result => {
					if (result.valid) {
						this.db.update({ user_id: message.author.id }, { $set: { public_key: armoredPublicKey } });
						this.emit('revocation', message);
					}
					else {
						this.emit('revocation', message, result.reason);
					}
				})
				.catch(err => {
					if (err.message === ERR_ARMORED) {
						// TODO emit pls
					}
					else {
						// unexpected err
					}
				});
			}
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

module.exports = Stowaway;
