const EventEmitter = require('events');
const https = require('https');
const openpgp = require('openpgp');
const { MessageAttachment } = require('discord.js');

const HANDSHAKE_REQUEST = "#### HANDSHAKE 0 ####";
const HANDSHAKE_RESPONSE = "#### HANDSHAKE 1 ####";
const ENCRYPTED_MESSAGE = "#### STOWAWAY ####";
const KEYFILE = "pubkey.txt";
const MSGFILE = "pgpmsg.txt";

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

function getAttachment (message, name) {
	const file = message.attachments.find(a => a.name == name);
	if (file != null) {
		return { exists: true, url: file.url };
	}
	else {
		return { exists: false };
	}
}

/* EVENTS
	channel delete
	channel update: channel
	message: timestamp. date string, user, content
	failed decrypt: user, date string
	failed encrypt: error
	handshake: user
	bad handshake: user
	database error : error string
*/
class SingleStowaway extends EventEmitter {
	constructor (key, channel, db) {
		super();
		this.key = key;
		this.channel = channel;
		this.db = db;
	}

	launch (client) {
		this.id = client.user.id;
		this._init()
		.catch((err) => { throw err; })
		.finally(() => {
			client.on('message', message => {
				this._handleMessage(message);
			});
			client.on('channelDelete', channel => {
				if (channel.id == this.channel.id) {
					this.emit('channel delete');
				}
			});
			client.on('channelUpdate', (ch0, ch1) => {
				if (ch0.id == this.channel.id) {
					this.channel = ch1;
					this.emit('channel update', this.channel);
				}
			});
		})
		// .then(() => { this.emit('debug', 'INITIALIZATION COMPLETE'); });
	}


	_handleMessage (message) {
		if (message.createdAt >= this.oldest) {
			if (message.channel.id == this.channel.id) {
				this.emit('timestamp', message.createdAt, message.id);
				if (message.author.id != this.id && (message.content === HANDSHAKE_REQUEST || message.content === HANDSHAKE_RESPONSE) && message.attachments.size > 0) {
					const keyFile = getAttachment(message, KEYFILE);
					if (keyFile.exists) {
						this.receiveHandshake(message.author, message.id, keyFile.url, message.content === HANDSHAKE_REQUEST)
						.then((flag) => {
							if (flag) {
								this.emit('handshake', message.createdTimestamp, message.createdAt, message.author);
							}
							this.updateLatests(message.createdTimestamp, message.id);
						})
						.catch(err => { this.emit('bad handshake', message.author); });
					}
					else {
						this.emit('bad handshake', message.author);
					}
				}
				else if (message.content === ENCRYPTED_MESSAGE && message.attachments.size > 0) {
					const messageFile = getAttachment(message, MSGFILE);
					if (messageFile.exists) {
						this.decrypt(messageFile.url)
						.then((plaintext) => {
							this.emit('message', message.createdTimestamp, message.createdAt, message.author, plaintext, message.id);
							this.updateLatests(message.createdTimestamp, message.id);
						})
						.catch((err) => { this.emit('failed decrypt', message.createdTimestamp, message.createdAt, message.author); });
					}
					else {
						this.emit('no encrypted file', message);
					}
				}
			}
		}
	}

	// NOTE this doesn't work as well as regular _handleMessage
	// batch assumed to all be from current channel
	_handleBatch (messages) {
		this._handshakes(messages).then(() => {
			messages.each(message => {
				this.emit('timestamp', message.createdAt, message.id);
				if (message.createdAt > this.oldest && message.content === ENCRYPTED_MESSAGE && message.attachments.size > 0) {
					const messageFile = getAttachment(message, MSGFILE);
					if (messageFile.exists) {
						this.decrypt(messageFile.url)
						.then((plaintext) => {
							this.emit('message', message.createdTimestamp, message.createdAt, message.author, plaintext, message.id);
							this.updateLatests(message.createdTimestamp, message.id);
						})
						.catch((err) => { this.emit('failed decrypt', message.createdTimestamp, message.createdAt, message.author); });
					}
					else {
						this.emit('no encrypted file', message);
					}
				}
			});
		});
	}

	_handshakes (messages) {
		return Promise.all(messages.map(message => {
			if (message.createdAt <= this.oldest) {
				return Promise.resolve();
			}
			else {
				return new Promise(resolve => {
					if (message.author.id != this.id && (message.content === HANDSHAKE_REQUEST || message.content === HANDSHAKE_RESPONSE) && message.attachments.size > 0) {
						const keyFile = getAttachment(message, KEYFILE);
						if (keyFile.exists) {
							this.receiveHandshake(message.author, message.id, keyFile.url, message.content === HANDSHAKE_REQUEST)
							.then((flag) => {
								if (flag) {
									this.emit('handshake', message.createdTimestamp, message.createdAt, message.author);
								}
								this.updateLatests(message.createdTimestamp, message.id);
								resolve();
							})
							.catch(err => {
								this.emit('bad handshake', message.author);
								resolve();
							});
						}
						else {
							this.emit('bad handshake', message.author);
							resolve();
						}
					}
					else {
						resolve();
					}
				});
			}
		}));
	}

	_init () {
		return new Promise((resolve, reject) => {
			this.db.findOne({ channel_id: this.channel.id , handshake: { $exists: true } }, (err, doc) => {
				if (err != null) {
					reject(err);
				}
				else if (doc == null) {
					this.handshake(HANDSHAKE_REQUEST)
					.then(message => {
						this.oldest = message.createdTimestamp;
						this.emit('handshake', message.createdTimestamp, message.createdAt, message.author);
						this.db.insert({
							channel_id: this.channel.id,
							handshake: message.id,
							last_seen: message.id,
							last_ts: message.createdTimestamp,
						}, () => {
							resolve();
						});
					})
					.catch(reject);
				}
				else {
					this.channel.messages.fetch(doc.handshake)
					.then(message => {
						this.oldest = message.createdTimestamp;
						this.emit('handshake', message.createdTimestamp, message.createdAt, message.author);
						return this.channel.messages.fetch({ around: doc.last_seen }, false, false)
					})
					.then(messages => {
						this._handleBatch(messages);
						// messages.each(message => { this._handleMessage(message); });
						resolve();
						// return this.channel.messages.fetch({after: doc.last_seen}, false, false);
					})
					// .then(messages => {
					// 	// messages.each(message => { this._handleMessage(message); });
					// 	resolve();this.db.update
					// })
					.catch(reject);
				}
			});
		});
	}

	fetchOlder (id) {
		return new Promise((resolve, reject) => {
			this.db.findOne({ channel_id: this.channel.id, handshake: { $exists: true }}, (err, doc) => {
				if (err != null) {
					reject(err);
				}
				if (doc != null) {
					this.channel.messages.fetch({ before: id }, false, false)
					.then(messages => {
						this._handleBatch(messages);
						// messages.each(message => { this._handleMessage(message); });
						// this.emit('notify', `${Array.from(messages.values()).length} older messages fetched`);
						// this.db.persistence.compactDatafile();
						resolve();
					})
					.catch(reject);
				}
			});
		});
	}

	fetchNewer (id) {
		return new Promise((resolve, reject) => {
			this.db.findOne({ channel_id: this.channel.id, handshake: { $exists: true }}, (err, doc) => {
				if (err != null) {
					reject(err);
				}
				if (doc != null) {
					this.channel.messages.fetch({ after: id }, false, false)
					.then(messages => {
						this._handleBatch(messages);
						// messages.each(message => { this._handleMessage(message); });
						// this.db.persistence.compactDatafile();
						resolve();
					})
					.catch(reject);
				}
			});
		});
	}

	// NOTE is ok
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

	encrypt (plainText)  {
		Promise.allSettled(this.channel.members.map(user => {
			return new Promise((resolve, reject) => {
				this.db.findOne({ user_id: user.id }, (err, doc) => {
					if (err) {
						this.emit('database error', `SingleStowaway.encrypt(), id argument: ${id}`);
						reject();
					}
					else if (doc != null) {
						resolve(doc.user_key);
					}
					reject();
				});
			});
		}))
		.then(values => {
			return values.filter(x => x.status === "fulfilled").map(x => x.value);
		})
		.then(armoredKeys => {
			return Promise.all(armoredKeys.map(armored => openpgp.key.readArmored(armored)));
		})
		.then(keys => {
			keys = keys.filter(k => k.err == null).map(k => k.keys[0]);
			return openpgp.encrypt({
				message: openpgp.message.fromText(plainText),
				publicKeys: [ this.key.toPublic() ].concat(keys),
			})
		})
		.then(encrypted => {
			const attachment = attachText(encrypted.data, MSGFILE);
			return this.channel.send(ENCRYPTED_MESSAGE, attachment);
		})
		.catch(err => { this.emit('error', err); })
	}

	handshake (str) {
		const attachment = attachText(this.key.toPublic().armor(), KEYFILE);
		return this.channel.send(str, attachment);
	}

	updateLatests (ts, id) {
		this.db.findOne({ channel_id: this.channel.id , handshake: { $exists: true }, last_seen: { $exists: true }, last_ts: { $exists: true }}, (err, doc) => {
			if (err != null) {
				throw err;
			}
			else if (doc != null) {
				if (ts > doc.last_ts) {
					this.db.update({ channel_id: this.channel.id, handshake: { $exists: true }}, { $set: { last_seen: id, last_ts: ts }}, { multi: true });
				}
			}
		});
	}

	receiveHandshake (user, messageID, keyURL, respond) {
		return new Promise((resolve, reject) => {
			this.db.findOne({ user_id: user.id }, (err, doc) => {
				if (err) {
					this.emit('database error', `SingleStowaway.receiveHandshake() id argument: ${user.id}`);
					reject();
				}
				else if (doc == null) {
					readAttached(keyURL)
					.then(keyStr => {
						return openpgp.key.readArmored(keyStr)
					})
					.then(({ keys, err }) => {
						if (err == null) {
							this.db.insert({  user_id: user.id, handshake_id: messageID, user_key: keys[0].armor() });
							if (respond) {
								this.handshake(HANDSHAKE_RESPONSE);
							}
							// this.emit('handshake', user);
							resolve(true);
						}
						else {
							reject();
						}
					})
					.catch(reject);
				}
				else {
					resolve(false);
				}
			});
		});
	}
}

/*
class PlaintextStowaway extends EventEmitter {
	constructor (channel, db) {
		super();
		this.channel = channel;
		this.db = db;
	}

	launch (client, verbose=false) {
		if (verbose) {
			console.log("Initializing STOWAWAY PLAINTEXT");
		}
		this.init(verbose)
		.then(() => {
			client.on('message', (m) => { this.handleMessage(m); });
			client.on('channelDelete', channel => {
				if (channel.id == this.channel.id) {
					this.emit('channel delete');
				}
			});
			client.on('channelUpdate', (ch0, ch1) => {
				if (ch0.id == channel.id) {
					this.channel = ch1;
					this.emit('channel update', this.channel);
				}
			});
			if (verbose) {
				console.log("Initialization complete!");
			}
		})
		.catch(err => { throw err; });
	}

	send (text) {
		this.channel.send(text);
	}

	handleMessage (message) {
		if (message.channel.id == this.channel.id) {
			this.db.update({ channel_id: this.channel.id}, { $set: { last_seen: message.id }}, () => {
				this.emit('message', message.createdTimestamp, message.createdAt, message.author, message.content);
			});
		}
	}

	init (verbose) {
		return new Promise((resolve, reject) => {
			console.log(this.channel.id);
			this.db.findOne({ channel_id: this.channel.id }, (err, doc) => {
				if (doc == null) {
					if (verbose) {
			}			cli.log("unrecognized channel: performing initial cache")
					}
					this.channel.messages.fetch({ limit: 1 })
					.then(message => {
						this.db.insert({ channel_id: this.channel.id, last_seen: message.id }, () => {
							resolve();
						});
					});
				}
				else {
					if (verbose) {
						cli.log("recognized channel: fetching unseen messages")
					}
					this.channel.messages.fetch({ after: doc.last_seen })
					.then(messages => {
						messages.sort((m0, m1) => m0.createdTimestamp - m1.createdTimestamp)
						.each((m) => { this.handleMessage(m); });
						resolve();
					})
				}
			});
		});
	}

}
*/

module.exports = {
	SingleStowaway: SingleStowaway,
	PlaintextStowaway: 0,
};
