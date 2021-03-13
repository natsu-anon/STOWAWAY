const EventEmitter = require('events');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const openpgp = require('openpgp');
const { MessageAttachment } = require('discord.js');

const STOWAWAY = '#### STOWAWAY ####';
const REGEX = /^#{4} STOWAWAY #{4}$/m;
const FILE = 'STOWAWAY.json';
const CHANNEL_MESSAGE = 'channel_message';
const HANDSHAKE_REQUEST = 'handshake_request';
const HANDSHAKE_RESPONSE = 'handshake_response';
const SIGNED_KEY = 'signed_key';
const KEY_UPDATE = 'key_update';
const REVOCATION = 'revocation';
const PROVENANCE_REQUEST = 'provenance_request';
const KEY_PROVENANCE = 'key_provenance';
// TODO session

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
	return attachText(JSON.stringify(json, null, '\t'));
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
	constructor (key, db, versionFlag=true, comment='') { // YES, you do want to pass in the key object
		super();
		this.key = key;
		this.fingerprint = key.getFingerprint();
		this.db = db;
		this.discordMessage = STOWAWAY;
		if (versionFlag) {
			this.discordMessage += '\nVERSION: 1.0.0';
		}
		if (comment.length > 0) {
			this.discordMessage += `\n${comment}`;
		}
	}

	async launch (client) {
		this.id = client.user.id;
		this.client = client;
		await this._cacheOld();
		client.on('message', message => {
			this._handleMessage(message);
		});
		client.on('channelDelete', channel => {
			// TODO remove channel from db if in db
		});
		client.on('channelUpdate', (ch0, ch1) => {
			// TODO set channel id of ch0 matches
		});
	}

	// implies existence of { old_key: armoredKey, old_fingerprint: fingerprint } in db
	_cacheOld () {
		return new Promise(resolve => {
			this.db.find({ old_key: { $exists: true } }, (err, docs) => {
				this.oldFingerprints = docs.map(doc => doc.old_fingerprint);
				Promise.all(docs.map(doc => {
					return openpgp.readKey({ armoredKey: doc.old_key });
				}))
				.then(keys => {
					this.oldKeys = keys;
					resolve();
				});
			});
		});
	}

	_updateLatests (channelId, messageId, messageTs) {
		this.db.findOne({ channel_id: channelId , handshake: { $exists: true } }, (err, doc) => {
			if (err != null) {
				this.emit('database error', `SingleStowaway.updateLatests() channel id argument: ${channelId}`);
			}
			else if (doc != null) {
				if (messageTS > doc.last_ts) {
					this.db.update({ channel_id: channelId, handshake_id: { $exists: true } }, { $set: { last_id: messageId, last_ts: messageTs } });
				}
			}
		});
	}

	_send (channel, attachment) {
		return channel.send(this.discordMessage, attachment);
	}

	_sendHandshake (channel, type) {
		return this._send(channel, attachJSON({
			type: type,
			public_key: this.key.toPublic().armor()
		}, FILE));
	}

	_sendKeyUpdate(armoredPublicKey) {
		const updateJSON = {
			type: KEY_UPDATE,
			publicKey: armoredPublicKey
		};
		this.db.find({ channel_id: { $exists: true }, handshake_id: { $exists: true } }, (err, docs) => {
			if (err != null) {
				this.emit('database error', 'Error while accsesing database in Stowaway._sendKeyUpdate()');
			}
			else {
				docs.forEach(doc => {
					this.client.channels.fetch(doc.channel_id, false)
					.then(channel => {
						this._send(channel, updateJSON);
					});
				});
			}
		});
	}

	// AFTER 1.0.0: SESSION SUPPORT
	// TODO:
	// MOSTLY DONE _message
	// MOSTLY DONE _handshake
	// MOSTLY DONE _signedKey
	// _keyUpdate
	// _keyRevocation
	// _provenanceRequest & _provenance
	// _keyProvenance
	_handleMessage (message) {
		this.db.findOne({ channel_id: message.channel.id, handshake_id: { $exists: true } }, (err, doc) => {
			if (err != null) {
				this.emit('database error', `Error while accessing database in Stowaway._handleMessage().  Channel id argument: ${message.channel.id}`);
			}
			else if (doc != null && message.createdTimestamp >= doc.handshake_ts) {
				this.emit('timestamp', message.channel.id, message.createdAt, message.id);
				if (REGEX.test(message.content) && message.attachments.size > 0) {
					const file = getAttachment(message);
					if (file.exists) {
						try {
							const data = JSON.parse(readAttached(file.url));
						}
						catch (err) {
							// emit something about malformed JSON
							return;
						}
						if (data.type === CHANNEL_MESSAGE) {
							if (data.encrypted != null) {
								this._messsage(data.encrypted, message); // may cause a key provenance
							}
							else {
								// emit something about no encrypted field
							}
						}
						else if (message.author.id !== this.id) {
							switch (data.type) {
								case HANDSHAKE_REQUEST:
									if (data.publicKey != null) {
										this._handshake(data.publicKey, message, true); // may cauase a handhsake
									}
									else {
										// emit something about no publicKey field
									}
									break;
								case HANDSHAKE_RESPONSE:
									if (data.publicKey != null) {
										this._handshake(data.publicKey, message, false);
									}
									else {
										// emit something about no publicKey field
									}
									break;
								case SIGNED_KEY:
									if (data.recipient != null && data.publicKey != null) {
										if (data.recipient === this.id) {
											this._signedKey(data.publicKey, message); // causes key update
										}
										// o.w. ignore
									}
									else {
										// emit something about missing recipient and/or publicKey
									}
									break;
								case KEY_UPDATE:
									if (data.publicKey != null) {
										this._keyUpdate(data.publicKey, message.author.id);
									}
									else {
										// emit something about no publicKey field
									}
									break;
								case REVOCATION:
									if (data.revokedKey != null && data.publicKey != null) {
										this._keyRevocation(data.revokedKey, data.publicKey);
									}
									else {
										// emit something about missing fields
									}
									break;
								case PROVENANCE_REQUEST:
									if (data.recipient != null && data.fingerprint != null) {
										if (data.recipient === this.id && data.fingerprint !== this.fingerprint) {
											this._provenanceRequest(data.fingerprint, message.author.id, message.channel);
										}
									}
									else {
										// emit missing fields
									}
									break;
								case KEY_PROVENANCE:
									if (data.recipient != null && key.order != null) {
										if (data.recipient == this.id) {
											this._keyProvenance(data.order);
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

	_message (armoredMessage, message) {
		openpgp.readMessage({ armoredMessage })
		.then(async (message) => {
			return openpgp.decrypt({
				message: message,
				publicKeys: await this._publicKey(message.author.id),
				privateKeys: [ this.key ].concat(this.oldKeys) // array of current private key & old (revoked) private key
			});
		})
		.then(async (decrypted) => {
			try {
				const json = JSON.parse(decrypted.data);
			}
			catch (err) {
				// emit something about malformed JSON in encrypted
				return;
			}
			if (json.fingerprints != null && json.plainText != null) {
				if (!json.fingerprints.includes(this.fingerprint)) {
					for (let i = 0; i < this.oldFingerprintHashes.length; i++) {
						if (json.fingerprints.includes(this.oldFingerprints[i])) {
							this._provenance(this.oldFingerprintHashes[i], message.author.id, message.channel);
							break;
						}
					}
				}
				if (decrypted.signatures.length > 0 && await decrypted.signatures[0].verified) {
					this.emit('verified message', message.channel.id, message.createdTimestamp, messsage.createdAt, message.author, plainText);
				}
				else {
					this.emit('unverified message', message.channel.id, message.createdTimestamp, messsage.createdAt, message.author, plainText);
				}
				this._updateLatests(message.channel.id, message.id, message.createdTimestamp);
			}
			else {
				// emit something about missing fields in encrypted
			}

		})
		.catch(err => {
			// check the error -- if it's from readMessage emit something about misformed armored text
			// if it's from decrypt emit something about decrypt emit decryption failure
		});
	}

	_handshake (armoredKey, message, respond) {
		new Promise((resolve, reject) => {
			this.db.findOne({ user_id: message.author.id }, (err, doc) => {
				if (err) {
					this.emit('database error', `Stowaway._handshake() user id argument: ${message.author.id}`);
					resolve(false);
				}
				else if (doc == null) {
					openpgp.readKey({ armoredKey }) // do this just to check it's armored key is actually a key
					.then(publicKey => {
						this.db.insert({ user_id: message.author.id, public_key: armoredKey });
						if (respond) {
							this._sendHandshake(message.channel, HANDHSHAKE_RESPONSE);
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

	// WIP -- use async -- promises are getting a little too complicated 4me
	_signedKey (armoredKey, channel, user) {
		openpgp.readKey({ armoredKey })
		.then(publicKey => {
			this.db.findOne({ user_id: user.id, public_key: { $exists: true } }, async (err, doc) => {
				if (err != null) {
				}
				else if (doc != null) {
					const userKey = await openpgp.readKey({ armoredKey: public_key })
					.then(userKey => {
						return publicKey.verifyPrimaryUser([ userKey ]);
					})
					.then(res => {
						return res.find(r => r.valid);
					})
					.then(res => {
						if (res == undefined) {
							// do provenance request
							throw Error('something about unrecognized signatures on key');
						}
					})
					.catch(err => { throw err; });
				}
				else {
					throw Error('something about unrecognized signatures on key');
				}
			});
			return this.key.update(publicKey);
		})
		.then(() => {
			this._sendKeyUpdate(this.key.toPublic().armor());
		})
		.catch(err => {
			// check the error -- if it's from readKey emit something about misformed armored key
			// if it's from update emit something else
		});
	}

	_keyUpdate (armoredKey, userId) {
		openpgp.readKey({ armoredKey })
		.then(async (publicKey) => {
			await publicKey.verifyPrimaryUser(
		})
		.then
	}

	_channelKeys (channel) {
		return new Promise(resolve => {
			 Promise.allSettled(channel.members.map(user => {
				return new Promise((res, rej) => {
					this.db.findOne({ user_id: user.id }, (err, doc) => {
						if (doc != null) {
							res(doc.public_key);
						}
						else {
							rej();
						}
					});
				});
			})
			.then(values => {
				return values.filter(x => x.status === 'fulfilled').map(x => x.value);
			})
			.then(armoredKeys => {
				return Promise.all(armoredKeys.map(armoredKey => {
					return openpgp.readKey({ armoredKey });
				}));
			})
			.then(resolve);
		});
	}

	_publicKey (userId) {
		return new Promise(resolve => {
			this.db.findOne({ user_id: userId, public_key: { $exists: true } }, (err, doc) => {
				if (err) {
					this.emit('database error', `Stowaway._publicKey() user id argument: ${userId}`);
				}
				else if (doc != null) {
					openpgp.readKey({ armoredKey: doc.public_key })
					.then(resolve);
				}
				resolve([]);
			});
		});
	}

	_encrypted (message) {
		const messageFile = getAttachment(message, MSGFILE);
		if (messageFile.exists) {
			this.decrypt(messageFile.url)
			.then(plaintext => {
				this.emit('message', message.channel.id, message.createdTimestamp, message.createdAt, message.author, plaintext, message.id);
			})
			.catch(() => { this.emit('failed decrypt', message.channel.id, message.createdTimestamp, message.createdAt, message.author); });
		}
		else {
			this.emit('no encrypted file', message.channel.id, message);
		}
	}

	decrypt (messageURL) {
		return new Promise((resolve, reject) => {
			readAttached(messageURL)
			.then(armoredText => {
				return openpgp.message.readArmored(armoredText);
			})
			.then(res => {
				return openpgp.decrypt({
					message: res,
					privateKeys: this.key,
				});
			})
			.then(res => {
				resolve(res.data);
			})
			.catch(reject);
		});
	}

	async encrypt (channel, plainText) {
		const armoredKeys = await Promise.allSettled(channel.members.map(user => {
			return new Promise((resolve, reject) => {
				this.db.findOne({ user_id: user.id }, (err, doc) => {
					if (err) {
						this.emit('database error', `Stowaway.encrypt(), user id argument: ${user.id}`);
						reject();
					}
					else if (doc != null) {
						resolve(doc.public_key);
					}
					else {
						reject();
					}
				});
			});
		}))
		.then(values => {
			return values.filter(x => x.status === 'fulfilled').map(x => x.value);
		});
		const keys = armoredKeys.map(armoredKey => {
			return await openpgp.readKey({ armoredKey });
		});

		.then(armoredKeys => {
			return Promise.all(armoredKeys.map(armored => openpgp.key.readArmored(armored)));
		})
		.then(keys => {
			keys = keys.filter(k => k.err == null).map(k => k.keys[0]);
			return openpgp.encrypt({
				message: openpgp.message.fromText(plainText),
				publicKeys: [ this.key.toPublic() ].concat(keys),
			});
		})
		.then(encrypted => {
			const attachment = attachText(encrypted.data, MSGFILE);
			return channel.send(ENCRYPTED_MESSAGE, attachment);
		})
		.catch(err => { this.emit('failed encrypt', plainText, err); });
	}

	fetchOlder (channel, messageID) {
		return new Promise((resolve, reject) => {
			this.db.findOne({ channel_id: channel.id, handshake: { $exists: true } }, (err, doc) => {
				if (err != null) {
					this.emit('database error', `Stowaway.fetchOlder() channel_id: ${channel.id}`);
					reject(err);
				}
				if (doc != null) {
					channel.messages.fetch({ before: messageID }, false, false)
					.then(messages => {
						messages.sort((m0, m1) => m0.createdTimestamp - m1.createdTimestamp)
						.each(message => {
							this._handleMessage(message);
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
			this.db.findOne({ channel_id: channel.id, handshake: { $exists: true } }, (err, doc) => {
				if (err != null) {
					this.emit('database error', `Stowaway.fetchNewer() channel_id: ${channel.id}`);
					reject(err);
				}
				if (doc != null) {
					channel.messages.fetch({ after: messageID }, false, false)
					.then(messages => {
						messages.sort((m0, m1) => m0.createdTimestamp - m1.createdTimestamp)
						.each(message => {
							this._handleMessage(message);
						});
						resolve();
					})
					.catch(reject);
				}
			});
		});
	}

	// handshakes channel if not in database
	loadChannel (channel) {
		this.db.findOne({ channel_id: channel.id , handshake: { $exists: true } }, (err, doc) => {
			if (err != null) {
				this.emit('database error', `Stowaway.loadChannel(), channel id argument: ${channel.id}`);
			}
			else {
				if (doc == null) { // handshake channel
					this._sendHandshake(channel, HANDSHAKE_REQUEST)
					.then(message => {
						this.db.insert({
							channel_id: channelID,
							handshake_id: message.id,
							handshake_ts: message.createdTimestsamp,
							last_id: message.id,
							last_ts: message.createdTimestamp,
						}, () => {
							this.emit('handshake', channel.id, message.createdTimestamp, message.createdAt, message.author);
						});
					});
				}
				else { // load messages around the last seen message
					channel.messages.fetch(doc.handshake)
					.then(message => {
						this.emit('handshake', channel.id, message.createdTimestamp, message.createdAt, message.author);
						return channel.messages.fetch({ around: doc.last_id }, false, false);
					})
					.then(messages => {
						messagses.sort((m0, m1) => m0.createdTimestamp - m1.createdTimestamp)
						.each(message => { this._handleMessage(message); });
					})
					.catch(err => {
						throw err;
					});
				}
			}
		});
	}

	signKey (channel, userId) {
	}

	knownSignatures (userId) {

	}
}

module.exports = Stowaway;
