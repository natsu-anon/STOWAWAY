const EventEmitter = require('events');
const https = require('https');
const openpgp = require('openpgp');
const { MessageAttachment } = require('discord.js');

const HANDSHAKE_REQUEST = '#### HANDSHAKE 0 ####';
const HANDSHAKE_RESPONSE = '#### HANDSHAKE 1 ####';
const SESSION = '#### SESSION ####';
// NOTE lmao probably gonna have to use regex
// TODO something for signing
// TODO something for signed key propagation
// TODO something for key revocation
const ENCRYPTED_MESSAGE = '#### STOWAWAY ####';
const REGEX = /^#{4} STOWAWAY #{4}$\n^version: \d+\.\d+\.\d+$/m;
const KEYFILE = 'pubkey.txt';
const MSGFILE = 'pgpmsg.txt';
const SFILE = 'session.txt';

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
	const file = message.attachments.find(a => a.name === name);
	if (file != null) {
		return { exists: true, url: file.url };
	}
	else {
		return { exists: false };
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
	constructor (key, db, versionFlag=true, comment='') {
		super();
		this.key = key;
		this.db = db;
		this.versionFlag = versionFlag;
		this.comment = comment;
	}

	launch (client) {
		this.id = client.user.id;
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


	_handleMessage (message) {
		this.db.findOne({ channel_id: message.channel.id, handshake: { $exists: true } }, (err, doc) => {
			if (err != null) {
				this.emit('database error', `Error while accessing database in Stowaway._handleMessage().  Channel id argument: ${message.channel.id}`);
			}
			else if (doc != null && message.createdTimestamp >= doc.oldest_ts) {
				this.emit('timestamp', message.channel.id, message.createdAt, message.id);
				if (message.author.id !== this.id && (message.content === HANDSHAKE_REQUEST || message.content === HANDSHAKE_RESPONSE) && message.attachments.size > 0) {
					this._handshake(message);
				}
				else if (message.content === ENCRYPTED_MESSAGE && message.attachments.size > 0) {
					this._encrypted(message);
				}
				// TODO session request
				// TODO session key
				// TODO key revocation
				// TODO key signing
				// TODO signed key propagation
			}

		});
	}

	_handshake (message) {
		const keyFile = getAttachment(message, KEYFILE);
		if (keyFile.exists) {
			this.receiveHandshake(message.channel, message.author.id, message.id, keyFile.url, message.content === HANDSHAKE_REQUEST)
			.then(() => {
				this.emit('handshake', message.channel.id, message.createdTimestamp, message.createdAt, message.author);
				this.updateLatests(message.channel.id, message.createdTimestamp, message.id);
			})
			.catch(() => { this.emit('bad handshake', message.channel.id, message.author); });
		}
		else {
			this.emit('bad handshake', message.channel, message.author);
		}

	}

	_encrypted (message) {
		const messageFile = getAttachment(message, MSGFILE);
		if (messageFile.exists) {
			this.decrypt(messageFile.url)
			.then(plaintext => {
				this.emit('message', message.channel.id, message.createdTimestamp, message.createdAt, message.author, plaintext, message.id);
				this.updateLatests(message.createdTimestamp, message.id);
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

	encrypt (channel, plainText) {
		Promise.allSettled(channel.members.map(user => {
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
		})
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

	handshake (channel, str) {
		const attachment = attachText(this.key.toPublic().armor(), KEYFILE);
		return channel.send(str, attachment);
	}

	// handshakes channel if not in database
	loadChannel (channel) {
		this.db.findOne({ channel_id: channel.id , handshake: { $exists: true } }, (err, doc) => {
			if (err != null) {
				this.emit('database error', `Stowaway.loadChannel(), channel id argument: ${channel.id}`);
			}
			else {
				if (doc == null) { // handshake channel
					this.handshake(channel, HANDSHAKE_REQUEST)
					.then(message => {
						this.db.insert({
							channel_id: channelID,
							handshake: message.id,
							oldest_ts: message.createdTimestsamp,
							last_seen: message.id,
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
						return channel.messages.fetch({ around: doc.last_seen }, false, false);
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

	// TODO also share current session key if receiving a HANDSHAKE_REQUEST
	receiveHandshake (channel, userId, messageId, keyURL, respond) {
		return new Promise((resolve, reject) => {
			this.db.findOne({ user_id: userId }, (err, doc) => {
				if (err) {
					this.emit('database error', `SingleStowaway.receiveHandshake() user id argument: ${userID}`);
				}
				else if (doc == null) {
					readAttached(keyURL)
					.then(keyStr => {
						return openpgp.key.readArmored(keyStr);
					})
					.then(({ keys, err }) => {
						if (err == null) {
							this.db.insert({ user_id: user.id, public_key: keys[0].armor() });
							if (respond) {
								this.handshake(channel, HANDSHAKE_RESPONSE);
								// TODO share session key as well
							}
							resolve();
						}
						else {
							reject();
						}
					})
					.catch(reject);
				}
				resolve();
			});
		});
	}

	updateLatests (channelId, messageTS, messageId) {
		this.db.findOne({ channel_id: channelId , handshake: { $exists: true } }, (err, doc) => {
			if (err != null) {
				this.emit('database error', `SingleStowaway.updateLatests() channel id argument: ${channelId}`);
			}
			else if (doc != null) {
				if (messageTS > doc.last_ts) {
					this.db.update({ channel_id: channelId, handshake: { $exists: true } }, { $set: { last_seen: messageId, last_ts: messageTS } });
				}
			}
		});
	}
}

module.exports = Stowaway;
