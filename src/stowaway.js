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
const HANDSHAKE_REQUEST = 'handshake_request';
const HANDSHAKE_RESPONSE = 'handshake_response';
const SIGNED_KEY = 'signed_key';
const KEY_UPDATE = 'key_update';
const REVOCATION = 'revocation';
const PROVENANCE_REQUEST = 'provenance_request';
const PARTIAL_PROVENANCE = 'partial_provenance';
const FULL_PROVENANCE = 'full_provenance';
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

	constructor (db, keyFile, version, comment='') {
		super();
		this.db = db;
		this.keyFile = keyFile;
		this.discordMessage = `${STOWAWAY}\nVERSION: ${version}`;
		if (comment.length > 0) {
			this.discordMessage += `\nUser comment: ${comment}`;
		}
	}

	// assume errors thrown by launch() are handled properly i.e. ones from openpgp.decryptKey()
	async launch (client, lockedKey, passphrase) {
		this.client = client;
		this.id = client.user.id;
		this.key = await openpgp.decryptKey({
			privateKey: lockedKey,
			passphase: passphrase
		});
		this.fingerprint = this.key.getFingerprint();
		await this.#cacheOldKeys();
		client.on('channelDelete', channel => {
			// TODO remove channel from db if in db
		});
		client.on('channelUpdate', (ch0, ch1) => {
			// TODO set channel id of ch0 matches
		});
		client.on('message', message => {
			this.#handleMessage(message);
		});
	}

	// needs existence of { key_index: uint, old_fingerprint: fingerprint, old_key: privateKey, old_revocation: revokingKey } in db
	#cacheOldKeys () {
		return new Promise((resolve, reject) => {
			this.db.find({ old_key: { $exists: true } }, (err, docs) => {
				if (err != null) {
					reject(err);
				}
				else {
					this.oldFingerprints = docs.map(doc => doc.old_fingerprint);
					Promise.all(docs.map(doc => {
						return openpgp.readKey({ armoredKey: doc.old_key });
					}))
					.then(keys => {
						this.oldKeys = keys;
						resolve();
					});
				}
			});
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
					this.#sendHandshake(channel, HANDSHAKE_REQUEST)
					.then(message => {
						this.db.insert({
							channel_id: channel.id,
							handshake_id: message.id,
							handshake_ts: message.createdTimestsamp,
							last_id: message.id,
							last_ts: message.createdTimestamp,
						}, () => {
							this.emit('handshake', channel.id, message.createdTimestamp, message.createdAt, message.author);
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
						resolve();
					})
					.catch(reject);
				}
			});
		});
	}

	// can revoke key0 without passphrase
	// assume key1 is decrypted already
	async revokeKey (client, key0, key1, revocationCertificate) {
		let { privateKey: revocation } = await openpgp.revokeKey({
			key0,
			revocationCertificate
		})
		revocation = await revocation.signPrimaryUser([ key1 ]);
		let key = await key1.signPrimaryUser([ revocation ]);
		await this.#writeKey(key.armor());
		this.#allChannels((err, docs) => {
			if (err) {
				this.emit('database error', 'SingleStowaway.revokeKey()');
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

	messageChannel (channel, plainText) {
		this.#publicKeys(channel)
		.then(publicKeys => {
			return openpgp.encrypt({
				message: openpgp.Message.fromText(
					JSON.stringify({
						fingerprints: publicKeys.map(k => k.getFingerprint()).concat(this.fingeprint),
						message: plainText
					}, null, '\t')),
				publicKeys: publicKeys.concat(this.key.toPublic()),
				privateKeys: this.key
			});
		})
		.then(armoredText => {
			this.#send(channel, attachJSON({
				type: CHANNEL_MESSAGE,
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
					const publicKey = await openpgp.readKey({ armoredKey: doc.public_key })
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
					const res = []
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
			})
		});
	}

	requestProvenance (channel, userId) {
		this.#findUser(userId, (err, doc) => {
			if (err != null) {
				// db error
			}
			else if (doc != null) {
				openpgp.readKey({ armoredKey: doc.public_key })
				.then(publicKey => {
					return this.#send(channel, attachJSON({
						type: PROVENANCE_REQUEST,
						recipient: userId,
						fingerprint: publicKey.getFingerprint()
					}));
				})
				.catch(err => {
					// emit something
				});
			}
			else {
				return this.#send(channel, attachJSON({
					type: PROVENANCE_REQUEST,
					recipient: userId
				}));
			}
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

	#send (channel, attachment) {
		return channel.send(this.discordMessage, attachment);
	}

	#sendHandshake (channel, type) {
		return this.#send(channel, attachJSON({
			type: type,
			public_key: this.key.toPublic().armor()
		}, FILE));
	}

	#sendKeyUpdate (armoredPublicKey) {
		const updateJSON = {
			type: KEY_UPDATE,
			publicKey: armoredPublicKey
		};
		this.allChannels((err, docs) => {
			if (err != null) {
				this.emit('database error', 'Error while accsesing database in Stowaway.#sendKeyUpdate()');
			}
			else {
				docs.forEach(doc => {
					this.client.channels.fetch(doc.channel_id, false)
					.then(channel => {
						this.#send(channel, updateJSON);
					})
					.catch(err => {
						this.emit('unexpected error', `error fetching channel with id: ${doc.channel_id} in _sendKeyUpdate():  ${err}`);
					});
				});
			}
		});
	}

	#sendKeySignature (channel, userId, armoredPublicKey) {
		this.#send(channel, attachJSON({
			type: SIGNED_KEY,
			recipient: userId,
			publicKey: armoredPublicKey
		}));
	}

	#sendPartialProvenance (channel, userId, order) {
		this.#send(channel, attachJSON({
			type:
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
	// TODO:
	// MOSTLY DONE _channelMessage
	// MOSTLY DONE _handshake
	// MOSTLY DONE _signedKey
	// MOSTLY DONE _keyUpdate
	// MOSTLY DONE _keyRevocation
	// MOSTLY DONE _provenanceRequest
	// DONE? _provenance
	// MOSTLY DONE _partialProvenance
	// _fullProvenance
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
						if (data.type === CHANNEL_MESSAGE) {
							if (data.encrypted != null) {
								this.#channelMessage(data.encrypted, message); // may cause a key provenance
							}
							else {
								// emit something about no encrypted field
							}
						}
						else if (message.author.id !== this.id) {
							switch (data.type) {
								case HANDSHAKE_REQUEST:
									if (data.publicKey != null) {
										this.#handshake(data.publicKey, message, true); // may cauase a handhsake
									}
									else {
										// emit something about no publicKey field
									}
									break;
								case HANDSHAKE_RESPONSE:
									if (data.publicKey != null) {
										this.#handshake(data.publicKey, message, false);
									}
									else {
										// emit something about no publicKey field
									}
									break;
								case SIGNED_KEY:
									if (data.recipient != null && data.publicKey != null) {
										if (data.recipient === this.id) {
											this.#signedKey(data.publicKey, message); // causes key update
										}
										// o.w. ignore
									}
									else {
										// emit something about missing recipient and/or publicKey
									}
									break;
								case KEY_UPDATE:
									if (data.publicKey != null) {
										this.#keyUpdate(data.publicKey, message.author.id);
									}
									else {
										// emit something about no publicKey field
									}
									break;
								case REVOCATION:
									if (data.revocation != null && data.publicKey != null) {
										this.#keyRevocation(data.revocation, data.publicKey, message.author); // force the user if to trust the revocation
									}
									else {
										// emit something about missing fields
									}
									break;
								case PROVENANCE_REQUEST:
									if (data.recipient != null && data.recipient === this.id) {
										if (data.fingerprint !== null && data.fingerprint === this.fingerprint) {
											this.#partialProvenanceRequest(data.fingerprint, message.channel, message.author.id);
										}
										else {
											this.#fullProvenanceRequest(message.channel, message.author.id);
										}
									}
									else {
										// emit missing fields
									}
									break;
								case PARTIAL_PROVENANCE:
									if (data.recipient != null && data.order != null && data.order.isArray()) {
										if (data.recipient === this.id) {
											if (data.order.length > 0) {
												this.#partialProvenance(data.order, message.author); // force the user to decide if to trust the provenance }
											}
											else {
												// emit something about 0 length provenance
											}
										}
									}
									else {
										// emit something about missing fields
									}
									break;
								case FULL_PROVENANCE:
									if (data.recipient != null && data.order != null && data.order.isArray()) {
										if (data.recipient === this.id) {
											if (data.order.length > 0) {
												this.#fullProvenance(data.order, message.author); // force the user to decide if to trust the provenance
											}
											else {
												// emit something about 0 length provenance
											}
										}
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

	// NOTE make sure this is only used in #channelMessage()
	#encrypted (armoredMessage, channel, userId) {
		return new Promise((resolve, reject) => {
			openpgp.readMessage({ armoredMessage })
			.then(async (message) => {
				return openpgp.decrypt({
					message: message,
					publicKeys: await this.#publicKey(userId),
					privateKeys: [ this.key ].concat(this.oldKeys) // array of current private key & old (revoked) private key
				});
			})
			.then(async (decrypted) => {
			})
			.catch(reject);
		});
	}

	#channelMessage (armoredMessage, message) {
		this.#encrypted(armoredMessage, message.channel, message.author.id)
		openpgp.readMeessage({ armoredMessage })
		.then(async (message) => {
			return openpgp.decrypt({
				message: message,
				publicKeys: await this.#publicKey(userId),
				privateKey: [ this.key ].concat(this.oldKeys)
			});
		})
		.then(async (decrypted) => {
			const json = JSON.parse(decrypted.data);
			if (!json.fingerprints.includes(this.fingerprint)) {
				for (let i = 0; i < this.oldFingerprintHashes.length; i++) {
					if (json.fingerprints.includes(this.oldFingerprints[i])) {
						this.#partialProvenanceRequest(this.oldFingerprintHashes[i], channel, userId);
						break;
					}
				}
			}
			return {
				verified: decrypted.signatures.length > 0 && await decrypted.signatures[0].verified,
				plaintext: json.plainText
			};
		})
		.then(result => {
			if (result.verified) {
				this.emit('verified message', message.channel.id, message.createdTimestamp, message.createdAt, message.author, result.plainText);
			}
			else {
				this.emit('unverified message', message.channel.id, message.createdTimestamp, message.createdAt, message.author, result.plainText);
			}
			this.#updateLatests(message.channel.id, message.id, message.createdTimestamp);
		})
		.catch(err => {
			if (err.name === ERR_SYNTAX) {
				// emit something about malformed JSON in encrypted
			}
			else if (err.message === ERR_ARMORED) {
				// emit something about misformed armored text
			}
			else if (err.message === ERR_DECRYPT) {
				// if you're here it's possible you (1) the author doesn't have your public key or (2) author has one of your revoked public keys
				// determine if you handshook with the author in the past
				// if so perform a full provenance
				// o.w. perform a handshake request
			}
			else {
				this.emit('unexpected error', `error in Stowaway.#message(): ${err}`);
			}
		});
	}

	#handshake (armoredKey, message, respond) {
		new Promise((resolve, reject) => {
			this.db.findOne({ user_id: message.author.id }, (err, doc) => {
				if (err) {
					this.emit('database error', `Stowaway.#handshake() user id argument: ${message.author.id}`);
					resolve(false);
				}
				else if (doc == null) {
					openpgp.readKey({ armoredKey }) // do this just to check it's armored key is actually a key
					.then(publicKey => {
						this.db.insert({ user_id: message.author.id, public_key: armoredKey });
						if (respond) {
							this.#sendHandshake(message.channel, HANDSHAKE_RESPONSE);
						}
					})
					.catch(reject);
				}
				else {
					resolve(false);
				}
			});
		})
		.then(flag => {
			if (flag) {
				this.emit('handshake', message.channel.id, message.createdTimestamp, message.createdAt, message.author);
			}
		})
		.catch(err => { this.emit('bad handshake', message.channel.id, message.author); });
	}

	#signedKey (armoredKey, channel, user) {
		openpgp.readKey({ armoredKey })
		.then(publicKey => {
			this.db.findOne({ user_id: user.id, public_key: { $exists: true } }, async (err, doc) => {
				if (err != null) {
				}
				else if (doc != null) {
					const userKey = await openpgp.readKey({ armoredKey: doc.public_key })
					.then(userKey => {
						return publicKey.verifyPrimaryUser([ userKey ]);
					})
					.then(res => {
						return res.find(r => r.valid);
					})
					.then(res => {
						if (res == undefined) {
							// emit something about lack of expected key signature so no update
						}
						else if (res.valid) {
							this.#updatePrivateKey(publicKey);
						}
					})
					.catch(err => {
						if (err.message === ERR_ARMORED) {
							// get here if readKey fails to read public_key
						}
						else {
							this.emit('unexpected error', `error in Stowaway.#signedKey(): ${err}`);
						}
					});
				}
				else {
					// emit something about unexpected key signature
				}
			});
		})
		.catch (err => {
			// can only be a ERR_ARMOR
		});
	}

	#updatePrivateKey (publicKey, sender) {
		this.key.update(publicKey)
		.then(() => {
			return this.#writeKey(this.key.armor())
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
					resolve()
				}
			});
		});
	}

	#keyUpdate (armoredKey, userId) {
		openpgp.readKey({ armoredKey })
		.then(publicKey1 => {
			this.#findUser(userId, (err, doc) => {
				if (err) {
					this.emit('database error', `Stowaway.#keyUpdate(), userId: ${userId}`);
				}
				if (doc != null) {
					openpgp.readKey({ armoredKey: doc.public_key })
					.then(publicKey0 => {
						publicKey0.update(publicKey1)
						.then(() => {
							this.db.update({ user_id: userId }, { $set: { public_key: publicKey0.armor() } });
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
			else {
				// TODO
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
			if (res[0].valid && res[1].valid && (await publicKey1.verifyPrimaryUser([ revocation ]))[0].valid) {
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

	#keyRevocation (armoredRevocation, armoredPublicKey, user) {
		this.#findUser(user.id, (err, doc) => {
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
						this.emit('successful revocation', user.id);
						this.db.update({ user_id: user.id }, { $set: { public_key: armoredPublicKey } });
					}
					else {
						this.emit('blocked revocation', user, result.reason);
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

	#partialProvenanceRequest (fingerprint, channel, userId) {
		if (this.old_fingerprints.contains(fingerprint)) {
			new Promise(resolve => {
				this.db.findOne({ old_fingerprint: fingerprint, key_index: { $exists: true } }, (err, doc) => {
					if (err != null) {
						this.emit('database error', `Stowaway.#provenanceRequest(), fingerprint argument: ${fingerprint}`);
					}
					else if (document != null) {
						resolve(doc.key_index);
					}
					else {
						this.emit('request error', `Stowaway.#provenanceRequest(), mismatched fingeprints! fingeprint: ${fingerprint} not in database`);
					}
				});
			})
			.then(index => {
				this.db.find({ key_index: { $gte: index } }).sort({ key_index: 1 }).exec((err, docs) => {
					if (err != null) {
						this.emit('database error', `Stowaway.#provenanceRequest(), index rgument: ${doc.key_index}`);
					}
					else {
						const order = [];
						for (let i = 0; i < docs.length - 1; i++) {
							order.push({
								revocation: docs[i].old_revocation,
								publicKey: docs[i + 1].old_key
							});
						}
						if (docs.length > 0) {
							order.push({
								revocation: docs[docs.length - 1].old_revocation,
								publicKey: this.key.toPublic()
							});
						}
						this.#sendPartialProvenance(channel, userId, order);
					}
				});
			});
		}
		else {
			this.#fullProvenanceRequest(channel, userId);
		}
	}

	#fullProvenanceRequest (channel, userId) {
		this.db.find({ key_index: { $exists: true } }).sort({ key_index: 1 }).exec((err, dos) => {
			if (err != null) {
					this.emit('database error', `Stowaway.#fullProvenanceRequest()`);
			}
			else {
				const order = []
				for (let i = 0; i < docs.length - 1; i++) {
					order.push({
						revocation: docs[i].old_revocation,
						publicKey: docs[i + 1].old_key
					});
				}
				if (docs.length > 0) {
					order.push({
						revocation: docs[docs.length - 1],
						publicKey: this.key.toPublic()
					});
				}
				this.#sendFullProvenance(channel, userId, order);
			}
		});
	}

	#partialProvenance (order, user) {
		if (order[0].revocation != null && order[0].publicKey != null) {
			this.#findUser(user.id, (err, doc) => {
				if (err != null) {
					this.emit('database error', `Stowaway.#partialProvenance() user id argument: ${user.id}`);
				}
				else if (doc != null) {
					Promise.all([
						openpgp.readKey({ armoredKey: order.revocation }),
						openpgp.readKey({ armoredKey: doc.public_key }),
						openpgp.readKey({ armoredKey: order.publicKey })
					])
					.then(keys => {
						this.#revocation(keys[0], keys[1], keys[2]);
					})
					.then(result => {
						if (result.valid) {
							if (order.length > 1) {
								return this.#tailProvenance(order.slice(1), result.publicKey);
							}
							else {
								// provenance is valid
								// ask the user if they want to update all their shit
								// show them all the inbetween keys (WITH SIGNATURES)
							}
						}
						else {
							return result;
						}
					})
					.then(result => {
						if (result.valid) {
							// provenance is valid
							// ask the user if they want to update all their shit
							// show them all the inbetween keys (WITH SIGNATURES)
						}
						else {
							// bad provenance
							// rat out sender
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
	}

	#fullProvenance (order, user) {
	}

	async #tailProvenance (order, publicKey0) {
		if (order[0].revocation != null && order[1].publicKey != null) {
			let revocation;
			let publicKey1;
			try {
				revocation = await openpgp.readKey({ armoredKey: order.revocation });
				publicKey1 = await openpgp.readKey({ armoredKey: order.publicKey });
			}
			catch (err) {
				return { valid: false, reason: 'misformed armored text' };
			}
			const result = await this.#revocation(revocation, publicKey0, publicKey1);
			if (result.valid && order.length > 1) {
				return this.#tailProvenance(order.slice(1), result.publicKey);
			}
			else {
				return result;
			}
		}
		else {
			return { valid: false, reason: 'order array element missing proper keys' };
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
		return new Promise(resolve => {
			this.findUser(userId, (err, doc) => {
				if (err) {
					this.emit('database error', `Stowaway.#publicKey() user id argument: ${userId}`);
				}
				else if (doc != null) {
					openpgp.readKey({ armoredKey: doc.public_key })
					.then(resolve);
				}
				resolve([]);
			});
		});
	}

}

module.exports = Stowaway;
