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
	return new Promise((res, rej) => {
		https.get(url, response => {
			response.on('data', d => res(d.toString()));
			response.on('error', d => rej(d));
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
	message: timestamp. date string, user, bool (you flag), content
	failed decrypt: user, date string
	failed encrypt: error
	handshake: user
	bad handshake: user
	database error : error string
*/
class SingleStowaway extends EventEmitter {
	constructor (key, client, db, channel) {
		super();
		this.key = key;
		this.db = db;
		this.channel = channel;
		this.selfTest = user => user.id == client.user.id;
		this.launch = (verbose=false) => {
			if (verbose) {
				console.log("Initializing STOWAWAY engine");
			}
			this._init(verbose).finally(() => {
				client.on('message', this._handleMessage);
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
				if (verbose) {
					console.log("Initialization complete!");
				}
				return this;
			});
		};
	}

	_handleMessage (message) {
		if (message.channel.id == this.channel.id) {
			this.db.update({ channel_id: this.channel.id}, { $set: { last_seen: message.id }}, () => {
				if (message.author.id != client.user.id && (message.content === HANDHSAKE_REQUEST || message.content === HANDHSAKE_RESPONSE) && message.attachments.size > 0) {
					const keyFile = getAttachment(KEYFILE);
					if (keyFile.exists) {
						receiveHandshake(message.author, message.id, keyFile.url, message.content === HANDSHAKE_REQUEST);
					}
					else {
						this.emit('bad handshake', message.author);
					}
				}
				else if (message.content === ENCRYPTED_MESSAGE && message.attachments.size > 0) {
					const messageFile = getAttachment(MSGFILE);
					if (messageFile.exists) {
						decrypt(message.createdTimestamp, message.createdAt, message.author, messageFile.url);
					}
					else {
						this.emit('no encrypted file', message);
					}
				}
			});
		}
	}

	_init (verbose) {
		return new Promise((resolve, reject) => {
			this.db.findOne({ channel_id: this.channel.id }, (err, doc) => {
				if (doc == null) {
					if (verbose) {
						console.log("unrecognized channel: performing handshake request")
					}
					this.handshake(HANDSHAKE_REQUEST)
					.then((message) => {
						this.db.insert({ channel_id: this.channel.id, handshake: message.id, last_seen: message.id }, () => {
							resolve();
						});
					});
				}
				else {
					if (verbose) {
						console.log("recognized channeL: fetching unseen messages")
					}
					this.channel.messages.fetch({ after: doc.last_seen })
					.then(messages => {
						messages.sort((m0, m1) => m0.createdTimestamp - m1.createdTimestamp).each(this._handleMessage);
					})
					.finally(resolve);
				}
			});
		});
	}

	decrypt (timestamp, date, author, messageURL) {
		readAttached(messageURL)
		.then(armoredText => {
			return openpgp.message.readArmored(armoredText);
		})
		.then(message => {
			return openpgp.decrypt({
				message: messsage,
				privateKeys: this.key
			});
		})
		.then(res => {
			this.emit('message', timestamp, date, author, this.selfTest(author), res.data);
		})
		.catch(err => { this.emit('failed decrypt', author, date); });
	}

	encrypt (plainText)  {
		Promise.allSettled(this.channel.members.keyArray().map(id => {
			new Promise((resolve, reject) => {
				this.db.findOne({ user_id: id }, (err, doc) => {
					if (err) {
						this.emit('database error', `SingleStowaway.encrypt(), id argument: ${id}`);
						reject();
					}
					else if (doc != null) {
						resolve(doc.user_key);
					}
					else {
						reject();
					}
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
		.catch(err => this.emit('failed encrypt', err));
	}

	handshake (str) {
		const attachment = attachText(this.key.toPublic().armor(), KEYFILE);
		return this.channel.send(str, attachment);
	}

	receiveHandshake (user, messageID, keyURL, respond) {
		this.db.findOne({ user_id: user.id }, (err, doc) => {
			if (err) {
				this.emit('database error', `SingleStowaway.receiveHandshake() id argument: ${user.id}`);
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
						this.emit('handshake', user);
					}
					else {
						this.emit('bad handshake', user);
					}
				})
				.catch(err => this.emit('bad handshake', user));
			}
		});
	}
}

class PlaintextStowaway extends EventEmitter {
	constructor (client, db, channel) {
		super();
		this.client = client;
		this.db = db;
		this.channel = channel;
	}

	launch (verbose=false) {
		if (verbose) {
			console.log("Initializing STOWAWAY PLAINTEXT");
		}
		this._init(verbose)
		.then(() => {
			// console.log(client);
			this.client.on('message', m => { this._handleMessage(m, this.channel.id) });
			this.client.on('channelDelete', channel => {
				if (channel.id == this.channel.id) {
					this.emit('channel delete');
				}
			});
			this.client.on('channelUpdate', (ch0, ch1) => {
				if (ch0.id == this.channel.id) {
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

	_handleMessage (message, chID) {
		if (message.channel.id == chID) {
			this.db.update({ channel_id: chID}, { $set: { last_seen: message.id }}, () => {
				this.emit('message', message.createdTimestamp, message.createdAt, message.author, message.content);
			});
		}
	}

	_init (verbose) {
		return new Promise((resolve, reject) => {
			this.db.findOne({ channel_id: this.channel.id }, (err, doc) => {
				if (doc == null) {
					if (verbose) {
						console.log("unrecognized channel: performing initial cache")
					}
					this.channels.messages.fetch({ limit: 1 })
					.then(message => {
						this.db.insert({ channel_id: this.channel.id, last_seen: message.id }, () => {
							resolve();
						});
					});
				}
				else {
					if (verbose) {
						console.log("recognized channel: fetching unseen messages")
					}
					this.channel.messages.fetch({ after: doc.last_seen })
					.then(messages => {
						messages.sort((m0, m1) => m0.createdTimestamp - m1.createdTimestamp)
						.each(m => { this._handleMessage(m, this.channel.id); });
						resolve();
					})
				}
			});
		});
	}

}

module.exports = {
	SingleStowaway: SingleStowaway,
	PlaintextStowaway: PlaintextStowaway,
};
