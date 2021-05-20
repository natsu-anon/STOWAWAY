const EventEmitter = require('events');
const openpgp = require('openpgp');
const { MessageAttachment } = require('discord.js');
const { writeFile, readUrl, hash } = require('./utils.js');


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

	constructor (channels, peers, revocations, keyFile, version, comment='', verbose=false) {
		super();
		this.channels = channels;
		this.peers = peers;
		this.peersView = peers.getDynamicView('all_peers');
		this.revocations = revocations;
		this.keyFile = keyFile;
		this.version = version;
		this.discordMessage = `${STOWAWAY}\nVERSION: ${version}`;
		if (comment.length > 0) {
			this.discordMessage += `\nUser comment: ${comment}`;
		}
		this.verbose = verbose;
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
			if (this.revocations.data.length > 0) {
				Promise.all(this.revocations.data.map(x => openpgp.readKey({
					armoredKey: x.revocation_ceritificate
				})))
				.then(resolve)
				.catch(reject);
			}
			else {
				resolve([]);
			}
		});
	}

	fetchNewer (channel, messageId) {
		return new Promise((resolve, reject) => {
			const doc = this._findChannel(channel.id);
			if (doc != null) {
				channel.messages.fetch({ after: messageId }, false, false)
				.then(messages => {
					return messages.sort((m0, m1) => m0.createdTimestamp - m1.createdTimestamp);
				})
				.then(messages => {
					return Promise.allSetteld(messages.map(message => this._handleActive(message)));
				})
				.then(() => {
					resolve();
				})
				.catch(reject);
			}
		});
	}

	fetchOlder (channel, messageId) {
		return new Promise((resolve, reject) => {
			const doc = this._findChannel(channel.id);
			if (doc != null) {
				channel.messages.fetch({ before: messageId }, false, false)
				.then(messages => {
					return messages.sort((m0, m1) => m0.createdTimestamp - m1.createdTimestamp);
				})
				.then(messages => {
					return Promise.allSetteld(messages.map(message => this._handleActive(message)));
				})
				.then(() => {
					resolve();
				})
				.catch(reject);
			}
		});
	}

	knownSignatures (userId) {
		return new Promise(async (resolve, reject) => {
			const doc = this._findPeer(userId);
			const docs = this._allPeers();
			if (doc != null) {
				const publicKey = await openpgp.readKey({ armoredKey: doc.public_key });
				const { publicKeys, userIds } = await new Promise(res => {
					Promise.all(docs.map(x => {
						return openpgp.readKey({ armoredKey: x.public_key });
					}))
					.then(keys => {
						res({ publicKeys: keys, userIds: docs.map(x => x.user_id) });
					})
					.catch(reject);
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
				this._handleCache(message);
			}
		});
		client.user.setPresence({
			activity: {
				type: 'LISTENING',
				name: ' dms for "about STOWAWAY"'
			},
			status: 'online'
		});
		client.on('channelDelete', channel => {
			this.channels.findAndRemove({ channel_id: channel.id });
		});
		client.on('channelUpdate', (ch0, ch1) => {
			if (Permissions(ch1, client.user).valid) {
				this.channels.findAndUpdate({ channel_id: ch0.id }, docs => {
					docs.channel_id = ch1.id;
				});
			}
			else {
				this.channels.findAndRemove({ channel_id: ch0.id });
			}
		});
		client.on('guildDelete', guild => {
			guild.channels.cache.each(channel => {
				this.channels.findAndRemove({ channel_id: channel.id });
			});
		});
		client.on('guildUpdate', (guild0, guild1) => {
			guild1.channels.cache.each(channel => {
				if (!Permissions(channel, client.user).valid) {
					this.channels.findAndRemove({ channel_id: channel.id });
				}
			});
		});
		client.on('guildMemberUpdate', (member0, member1) => {
			if (member0.id === this.id) {
				member1.guild.channels.cache.each(channel => {
					if (!Permissions(channel, member1.user).valid) {
						this.channels.findAndRemove({ channel_id: channel.id });
					}
				});
			}
		});
		this.lastChannel = this.channels.findOne({ last_channel: true });
		return new Promise((resolve, reject) => {
			Promise.all(this.channels.data.map(doc => new Promise(res => {
				client.channels.fetch(doc.channel_id, false)
				.then(channel => {
					if (channel.deleted || !Permissions(channel, client.user).valid) {
						this.channels.remove(doc);
					}
				})
				.finally(res);
			})))
			.then(() => this._revocations)
			.then(keys => {
				this.oldKeys = keys;
				resolve();
			})
			.catch(reject);
		});
	}

	// handshakes channel if not in database
	// returns a promise so you can enable autoscroll after loading
	loadChannel (channel) {
		return new Promise(resolve => {
			const doc = this._findChannel(channel.id);
			if (doc == null) { // handshake new channel
				this._sendHandshake(channel, true)
				.then(message => {
					// this.emit('test', `handshake0 ${message.createdTimestamp}`);
					this.channels.insert({
						channel_id: channel.id,
						last_channel: true,
						handshake: {
							id: message.id,
							ts: message.createdTimestamp
						},
						last_seen: {
							id: message.id,
							ts: message.createdTimestamp
						},
						decryption_failures: [], // array of message ids you already failed to decrypt
						cache: [] // array of message ids you already processed -- just fast-track em to the emission step -- CACHE ALL NON-MESSAGES
					});
					this.emit('handshake channel', channel);
					this.emit('handshake', message, true);
					this.channels.findAndUpdate({ last_channel: true, channel_id: { $ne: channel.id } }, docs => {
						docs.last_channel = false;
					});
					this.channelId = channel.id;
					this.emit('read channel', channel);
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
					return messages.sort((m0, m1) => m0.createdTimestamp - m1.createdTimestamp);
				})
				.then(messages => {
					return Promise.allSettled(messages.map(message => this._handleActive(message)));
				})
				.then(() => {
					this.channels.findAndUpdate({ last_channel: true, channel_id: { $ne: channel.id } }, docs => {
						docs.last_channel = false;
					});
					doc.last_channel = true;
					this.channels.update(doc);
					this.channelId = channel.id;
					this.emit('read channel', channel);
				})
				.catch(err => {
					this.emit('error', `unexpected error in Stowaway.loadChannel() ${err.stack}`);
				})
				.finally(() => {
					resolve(channel);
				});
			}
		});
	}

	messagePublic (channel, text) {
		// this.emit('test', `messaging ${channel.guild.name} #${channel.name}`);
		return new Promise(resolve => {
			this._publicKeys(channel)
			.then(async publicKeys => openpgp.encrypt({
				message: await openpgp.createMessage({ text }),
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
			.catch(err => { this.emit('error', `failed to encrypt: ${text}\n${err.stack}`); })
			.finally(resolve);
		});
	}

	messageSigned (channel, text) {
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
		.then(async signedKeys => openpgp.encrypt({
			message: await openpgp.createMessage({ text }),
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
		.catch(err => { this.emit('error', `failed to encrypt: ${text}\n${err.stack}`); });
	}

	// NO LONGER A PROMISE
	numberStowaways (channel) {
		let res = 0;
		this._allPeers().forEach(doc => {
			channel.members.find(user => user.id === doc.user_id)
			.each(() => {
				res++;
			});
		});
		return res;
	}

	// OK to run before launch
	// can revoke key0 without passphrase
	// assume key1 is decrypted already
	revokeKey (client, key0, key1, revocationCertificate) {
		return new Promise(async (resolve, reject) => {
			const channelIds = this.channels.data.map(x => x.channel_id);
			if (channelIds.length > 0) {
				let revocations = this.revocations.data.map(x => x.revocation_certificate);
				let { privateKey: revocation } = await openpgp.revokeKey({
					key: key0,
					revocationCertificate
				});
				revocation = await revocation.signPrimaryUser([ key1 ]);
				this.revocations.insert({
					fingerprint: revocation.getFingerprint(),
					revocation_certificate: revocation.armor()
				});
				revocations = await Promise.all(revocations.map(armor => openpgp.readKey({ armoredKey: armor })));
				revocations = await Promise.all(revocations.map(r => r.signPrimaryUser([ key1 ])));
				revocations.push(revocation);
				const publicKeyArmored = key1.toPublic().armor();
				const armoredRevocation = revocation.toPublic().armor();
				this.key = key1;
				if (this.oldKeys !== undefined) {
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
			}
			else {
				this.key = key1;
				resolve(key1);
			}
		});
	}

	signKey (channel, userId) {
		return new Promise(resolve => {
			const doc = this._findPeer(userId);
			if (doc != null) {
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
	}

	async signedKey (userId) {
		const publicKey = await this._publicKey(userId, 'Stowaway.signedKey()');
		const bonafides = await publicKey.verifyPrimaryUser([ this.key ]);
		return bonafides.find(x => x.valid) !== undefined;
	}

	_allPeers () {
		return this.peersView.data();
	}

	_attachJSON (json, name) {
		json.version = this.version;
		return attachJSON(json, name);
	}

	_findChannel (channelId) {
		return this.channels.findOne({ channel_id: channelId });
	}

	_findPeer (userId) {
		return this.peers.findOne({ user_id: userId, public_key: { $exists: true } });
	}

	_publicKey (userId, origin) {
		if (userId === this.id || userId == null) {
			return Promise.resolve(this.key.toPublic());
		}
		else {
			return new Promise((resolve, reject) => {
				const doc = this._findPeer(userId);
				if (doc != null) {
					openpgp.readKey({ armoredKey: doc.public_key })
					.then(resolve)
					.catch(reject);
				}
				else {
					reject(Error(`No entry for userId ${userId}! Called from: ${origin}`));
				}
			});
		}
	}

	async _publicKeys (channel) {
		const memberIds = channel.members.map(member => member.user.id);
		const armoredKeys = [];
		let doc;
		for (let i = 0; i < memberIds.length; i++) {
			doc = this.peers.findOne(memberIds[i]);
			if (doc != null) {
				armoredKeys.push(doc.public_key);
			}
		}
		// console.log(memberIds);
		// const armoredKeys = this.peers.find({
		// 	user_id: { $cointainsAny: memberIds }
		// }).data.map(doc => doc.public_key);
		// return await Promise.all(this.peersView.applyFind({
		// 	user_id: { $cointainsAny: channel.members.map(m => m.user.id) }
		// })
		// .data()
		// .map(doc => openpgp.readKey({
		// 	armoredKey: doc.public_key
		// })));
		return await Promise.all(armoredKeys.map(armoredKey =>
			openpgp.readKey({ armoredKey })
		));
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
		this.channels.findAndUpdate({ channel_id: channelId }, docs => {
			if (ts > docs.last_seen.ts) {
				docs.last_seen = { id, ts };
			}
		});
	}

	//  MESSAGE HANDLING  //

	// AFTER 1.0.0: SESSION SUPPORT
	// NOTE since only guild channel messages get processed you can use message.member to access the guildMember of the sender
	_handleActive (message) {
		return new Promise(resolve => {
			if (this._validMessage(message)) {
				this._processJSON(message)
				.then(json => {
					// this.emit('test', `_handleActive() ${message.author.username} ${JSON.stringify(json)}\n`);
					// this.emit('test', `_handleActive() ${json.type} from ${message.author.username}`);
					if (json.type === CHANNEL_MESSAGE) {
						// this.emit('test', '_handleActive() channel message');
						if (json.message != null && (typeof json.public) === 'boolean') {
							return this._channelMessage(json.message, json.public, message);
						}
						else {
							throw Error(`missing keys for channel message in JSON. Keys found:\n${Object.keys(json)}`);
						}
					}
					else if (message.author.id !== this.id) {
						return this._cacheMessage(json, message, false);
					}
					else {
						return Promise.resolve();
					}
				})
				.catch(err => {
					if (err != null) {
						this.emit('error', `Error in Stowaway._handleActive()\n${err.stack}`);
					}
					else {
						this.emit('error', 'Unexpected error in Stowaway._handleActive()');
					}
				})
				.finally(() => {
					resolve();
				});
			}
			else {
				resolve();
			}
		});
	}

	_handleCache (message) {
		if (message.author.id !== this.id && this._validMessage(message)) {
			this._processJSON(message)
			// .then(json => this._cacheMessage(json, message, true))
			.then(json => {
				// this.emit('test', `_handleCache() ${message.author.username} ${JSON.stringify(json)}\n`);
				// this.emit('test', '_handleCache()');
				// this.emit('test', `_handleCache() ${json.type}`);
				return this._cacheMessage(json, message, true);
			})
			.catch(err => {
				if (err != null) {
					this.emit('error', `Error in Stowaway._handleCache()\n${err.stack}`);
				}
				else {
					this.emit('error', 'Unknown error in Stowaway._handleCache()');
				}
			});
		}
	}

	_cacheMessage (json, message, notify) {
		// if not notifying then chechk the cache
		if (notify) {
			return this._processMessage(json, message, notify);
		}
		else {
			const doc = this._findChannel(message.channel.id);
			if (doc != null) {
				return this._processMessage(json, message, notify, doc.cache.includes(message.id));
			}
			else {
				this.emit('error', `error in Stowaway._cacheMessage(). ${message.channel.name} (${message.channel.id}) not in database`);
				return Promise.resolve();
			}
		}
	}

	_cache (message) {
		this.channels.findAndUpdate({ channel_id: message.channel.id }, docs => {
			if (!docs.cache.includes(message.id)) {
				docs.cache.push(message.id);
			}
		});
	}

	_processMessage (json, message, notify, cached=false) {
		return new Promise(resolve => {
			switch (json.type) {
				case HANDSHAKE:
					if (json.public_key != null && (typeof json.respond) === 'boolean' && Array.isArray(json.revocations))
					{
						this._handshake(json.public_key, json.respond, json.revocations, message, cached) // may cauase a handhsake
						.then(({ cache, color, text }) => {
							if ((this.verbose || notify) && color != null && text != null) { // NOTE uncomment this, delete below
								this.emit('notify', color, text);
							}
							if (cache) {
								// this.emit('test', 'cache handshake');
								this._cache(message);
							}
						})
						.finally(resolve);
					}
					else {
						// throw Error(`missing json keys for handshake. Keys found: ${Object.keys(json)}`);
						resolve();
					}
					break;
				case SIGNED_KEY:
					if (json.recipient != null && json.publicKey != null) {
						if (json.recipient === this.id) {
							this._signedKey(json.publicKey, message) // causes handshakes
							.then(({ cache, text }) => {
								if ((this.verbose || notify) && text != null) {
									this.emit('notify', 'blue', text);
								}
								if (cache) {
									this.emit('test', 'caching keysig');
									this._cache(message);
								}
							})
							.finally(resolve);
						}
						else {
							resolve();
						}
					}
					else {
						// throw Error('missing json keys for signed key');
						resolve();
					}
					break;
				case REVOCATION:
					if (json.revocation != null && json.publicKey != null) {
						this._revocation(json.revocation, json.publicKey, message, cached)
						.then(({ cache, color, text }) => {
							if ((this.verbose || notify) && color != null && text != null) {
								this.emit('notify', color, text);
							}
							if (cache) {
								this._cache(message);
							}
						})
						.finally(resolve);
					}
					else {
						// throw Error('missing json keys for revocation');
						resolve();
					}
				default:
					resolve();
					break;
			}
		});
	}

	_validMessage (message) {
		const doc = this._findChannel(message.channel.id);
		if (doc != null && message.createdTimestamp > doc.handshake.ts) {
			this.emit('timestamp', message.channel.id, message.createdAt, message.id);
			return message.content != null && message.editedAt == null && message.content.match(STOWAWAY_RGX);
		}
		else {
			return false;
		}
 }

	async _processJSON (message) {
		const file = getAttachment(message);
		if (file.exists) {
			const attached = await readUrl(file.url);
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

	/*  TYPE HANDLERS  */

	// OK
	_channelMessage (armoredMessage, publicFlag, message) {
		this._publicKey(message.author.id, 'Stowaway._channelMessage()')
		.then(publicKey => {
			// this.emit('test', `processing message on ${message.channel.name} from ${message.member.name}`);
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
			this.emit('test', `${publicFlag? 'public' : 'signed-only'} message from ${message.author.tag}: (signed: ${result.signed}, verified: ${result.verified}) ${result.plainText}`);
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
					const doc = this._findChannel(message.channel.id);
					if (doc != null) {
						if (!doc.decryption_failures.contains(message.id)) {
							doc.push(message.id);
							this.channels.update(doc);
						}
					}
					else {
						this.emit('error', `database error in Stowaway.decrypt() channel id argument: ${message.channel.id} not in database`);
					}
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
	async _handshake (armoredKey, plsRespond, revocations, message, cached) {
		const userId = message.author.id;
		const doc = this._findPeer(userId);
		if (doc == null) {
			try {
				await openpgp.readKey({ armoredKey }); // do this just to check it's armored key is actually a key
				this.peers.insert({
					user_id: userId,
					public_key: armoredKey,
					armor_hash: hash(armoredKey)
				});
				if (plsRespond) {
					await this._sendHandshake(message.channel, false);
				}
				this.emit('handshake', message, true);
				return {
					cache: true,
					color: 'green',
					text: `New handshake from ${message.member.displayName} on ${message.guild.name} #${message.channel.name}`
				};
			}
			catch (err) {
				this.emit('handshake', message, false);
				if (err != null) {
					this.emit('error', `Error in Stowaway._handshake():\n${err.stack}`);
				}
				else {
					this.emit('error', `Unexpected error in Stowaway._handshake()`);
				}
				return{
					cache: false,
					color: 'yellow',
					text: `Improper amrmored key in handshake from ${message.author.tag}`
				};
			}
		}
		else {
			try {
				const publicKey = await openpgp.readKey({ armoredKey });
				const savedKey = await openpgp.readKey({ armoredKey: doc.public_key });
				if (doc.armor_hash === hash(armoredKey) && cached) {
					this.emit('handshake', message, true);
					// this.emit('test', 'retrieved cached handshake');
					return {cache: false};
				}
				else if (publicKey.hasSameFingerprintAs(savedKey)) {
					if (cached) {
						this.emit('key update', message);
						return {cache: false };
					}
					else {
						await savedKey.update(publicKey);
						const armor = savedKey.armor();
						doc.public_key = armor;
						doc.armor_hash = hash(armor);
						this.peers.update(doc);
						this.emit('key update', message);
						return {
							cache: false,
							color: 'green',
							text: `Key update from ${message.author.tag}`
						};
					}
				}
				else if (cached) {
					this.emit('revocation', message);
					return { cache: false };
				}
				else {
					let revocation;
					for (let i = 0; i < revocations.length; i++) {
						revocation = await openpgp.readKey({ armoredKey: revocations[i] });
						if (revocation.hasSameFingerprintAs(savedKey)) {
							doc.public_key = armoredKey;
							this.peers.update(doc);
							this.emit('revocation', message);
							return {
								cache: true,
								color: 'green',
								text: `Key revocation from ${message.author.tag}`
							};
						}
					}
					return {};
				}
			}
			catch {
				return {
					cache: false,
					color: 'yellow',
					text: `Improper armored key in handshake from ${message.author.tag}`
				};
			}
		}
	}

	// not GOOF'D?
	async _signedKey (armoredKey, message, cached) {
		if (cached) {
			this.emit('test', 'using cached signature');
			this.emit('signed key', message);
			return {
				cache: false
			};
		}
		else {
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
						return {
							cache: true,
							text: `${message.author.tag} signed your key!`
						};
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
	}

	async _updatePrivateKey (publicKey) {
		await this.key.update(publicKey);
		const docs = this.channels.data;
		for (let i = 0; i < docs.length; i++) {
			await this._sendHandshake((await this.client.channels.fetch(docs[i].channel_id, false)), false);
		}
		await writeFile(this.keyFile, (await openpgp.encryptKey({
			privateKey: this.key,
			passphrase: this.passphrase
		})).armor());
	}

	_revocation (armoredRevocation, armoredKey, message, cached) {
		if (cached) {
			this.emit('revocation', message);
			return Promise.resolve({
				cache: false
			});
		}
		else {
			return new Promise(resolve => {
				Promise.all([
					this._publicKey(message.author.id, 'Stowaway._revocation()'),
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
						this.peers.findAndUpdate({ user_id: message.author.id }, docs => {
							docs.public_key = armoredKey;
						});
						this.emit('revocation', message);
						resolve({
							cache: true,
							color: 'green',
							text: `Key revocation from ${message.author.tag}`
						});
					}
					else if (reason === 'not needed') {
						this.emit('revocation', message);
						resolve({
							cache: true
						});
					}
					else {
						resolve({
							cache: false,
							color: 'red',
							text: `{underline}FRAUDULENT KEY REVOCATION FROM ${message.author.tag}`
						});
					}
				})
				.catch(err => {
					if (err != null) {
						this.emit('error', `error in Stowaway._revocation()\n${err.stack}`);
						resolve({
							cache: false,
							color: 'yellow',
							text: `Error in Stowaway._revocation(): ${err}`
						});
					}
					else {
						this.emit('error', `unknown error in Stowaway._revocation()`);
						resolve({ valid: false, reason: 'Unknown error' });
						resolve({
							cache: false,
							color: 'yellow',
							text: `Unknown error in Stowaway._revocation()`
						});
					}
				});
			});
		}
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
