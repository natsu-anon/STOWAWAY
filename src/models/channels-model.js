const Model = require('./model.js');
const { StowawayPermissions } = require('./stowaway.js');

function channelData (channel) {
	return {
		id: channel.id,
		name: channel.name,
		serverId: channel.guild.id,
		serverName: channel.guild.name,
	};
}

class ChannelsModel extends Model {
	#data;
	#launchChannel;

	constructor () {
		super();
		this.#data = [];
	}

	get launchChannel () {
		return this.#launchChannel;
	}

	get data () {
		return this.#data;
	}

	async initialize (stowaway, client, db, verbose=false) {
		if (verbose) {
			console.log('initializing channels model');
		}
		await this.#initCache(client, db);
		if (verbose) {
			console.log('cache initialized');
		}
		this.#initClient(client, db);
		this.#initStowaway(stowaway);
		this.#launchChannel = await this.#getLaunchChannel(db);
		this.db = db;
		if (verbose) {
			console.log('launch channel set');
		}
		return this;
	}

	setFavorite (channelId, number) {
		return new Promise((resolve, reject) => {
			let channel = this.#data.find(({ favoriteNumber }) => favoriteNumber === number);
			if (channel !== undefined) {
				channel.favoriteNumber = undefined;
			}
			channel = this.getChannel(channelId);
			if (channel !== undefined) {
				if (channel.handshaked) {
					channel.favoriteNumber = number;
					this.db.update({ favorite_number: number }, { $unset: { favorite_number: number } }, {}, err => {
						if (err != null) {
							reject(Error('database error in Servers.setFavorite()'));
						}
						else {
							this.db.update({ channel_id: channelId }, { $set: { favorite_number: number } });
						}
					});
					this.emit('update');
					resolve();
				}
				else {
					reject(Error(`Error in Servers.setFavorite(); Cannot favorite non-handshaked channel ${channelId}!`));
				}
			}
			else {
				reject(Error(`Error in Servers.setFavorite(): Unrecognized channel ${channelId}`));
			}
		});
	}

	clearFavorite (channelId) {
		return new Promise((resolve, reject) => {
			const channel = this.getChannel(channelId);
			if (channel !== undefined) {
				channel.favoriteNumber = undefined;
				this.db.remove({ favorite_id: channelId }, {}, err => {
					if (err != null) {
						reject(err);
					}
					else {
						this.emit('update');
						resolve();
					}
				});
			}
			else {
				resolve();
				// channel DNE in #data... so mb everything is fine?
			}
		});
	}

	getFavorite (number) {
		return new Promise((resolve, reject) => {
			const channel = this.#data.find(({ favoriteNumber }) => favoriteNumber === number);
			if (channel !== undefined) {
				resolve(channel.id);
			}
			else {
				reject(Error(`Error in Servers.getFavorite(): Unrecognized favorite: ${number}`));
			}
		});
	}

	getChannel (channelId) {
		return this.#data.find(({ id }) => id === channelId );
	}

	getChannelIndex (channelId) {
		return this.#data.findIndex(({ id }) => id === channelId);
	}

	#getLaunchChannel (db) {
		return new Promise((resolve, reject) => {
			db.findOne({ last_channel: { $exists: true } }, (err, doc) => {
				if (err != null) {
					reject();
				}
				else if (doc != null) {
					const channel = this.getChannel(doc.last_channel);
					if (channel !== undefined) {
						resolve(channel.id);
					}
					else {
						reject(Error('Unexpected error in ChannelsModel.#getLaunchChannel()'));
					}
				}
				else if (this.#data.length > 0) {
					const channel = this.#data.find(x => x.handshaked);
					resolve(channel !== undefined ? channel.id : this.#data[0].id);
				}
				else {
					reject();
				}
			});
		});
	}

	/* DEPRECATED
	firstHandshaked () {
		for (let i = 0; i < this.#data.length; i++) {
			if (this.#data[i].handshaked) {
				return i;
			}
		}
		return 0;
	}

	lastHandshaked () {
		for (let i = this.#data.length - 1; i > -1; i--) {
			if (this.#data[i].handshaked) {
				return i;
			}
		}
		return this.#data.length - 1;
	}
	*/

	// NOTE: firstServer() would just return the 0th index.  THINK ABOUT IT.

	lastServer () {
		for (let i = this.#data.length - 2; i > -1; i--) {
			if (this.#data[i + 1].serverId !== this.#data[i].serverId) {
				return i + 1;
			}
		}
		return 0;
	}

	#initCache (client, db) {
		// client.guilds.cache.each(guild => {
		// 	guild.channels.cache.filter(channel => channel.isText())
		// 	.each(channel => {
		// 		if (stowawayPermissions(channel, client.user)) {
		// 			this.#data.push(channelData(channel));
		// 		}
		// 	});
		// });
		return new Promise((resolve, reject) => {
			db.find({ channel_id: { $exists: true }, handshake_id: { $exists: true } }, (err, docs) => {
				if (err != null) {
					reject(err);
				}
				else {
					let temp;
					Promise.all(docs.map(x => {
						return new Promise((res, rej) => {
							client.channels.fetch(x.channel_id)
							.then(channel => {
								temp = channelData(channel);
								if (x.favorite_number != null) {
									temp.favoriteNumber = x.favorite_number;
								}
								this.#data.push(temp);
								res();
							})
							.catch(rej);
						});
					}))
					.then(() => {
						this.#sortChannels();
						resolve();
					})
					.catch(reject);
				}
			});
		});
	}

	#initClient (client, db) {
		// client.on('guildCreate', server => {
		// 	server.channels.cache.filter(channel => channel.isText() && stowawayPermissions(channel, client.user))
		// 	.each(channel => {
		// 		this.#data.push(channelData(channel));
		// 	});
		// 	this.#sortChannels();
		// 	this.emit('update');
		// });
		client.on('guildDelete', server => {
			// RETVRN TO TRADITION
			for (let i = this.#data.length - 1; i >= 0; i--) {
				if (this.#data[i].serverId === server.id) {
					db.remove({ favorite_id: this.#data[i].id });
					this.#data.splice(i, 1);
				}
			}
			this.emit('update');
		});
		client.on('guildUpdate', (server0, server1) => {
			for (let i = 0; i < this.#data.length; i++) {
				if (this.#data[i].serverId === server0.id) {
					this.#data[i].serverId = server1.id;
					this.#data[i].serverName = server1.name;
				}
			}
			this.emit('update');
		});
		// client.on('channelCreate', channel => {
		// 	if (channel.type !== 'dm') {
		// 		if (channel.isText() && stowawayPermissions(channel, client.user)) {
		// 			this.#data.push(channelData(channel));
		// 			this.#sortChannels();
		// 			this.emit('update');
		// 		}
		// 	}
		// });
		client.on('channelDelete', channel => {
			if (channel.type !== 'dm') {
				const i = this.getChannelIndex(channel.id);
				if (i >= 0) {
					db.remove({ favorite_id: this.#data[i].id });
					this.#data.splice(i, 1);
					this.emit('update');
				}
			}
		});
		client.on('channelUpdate', (channel0, channel1) => {
			if (channel0.type !== 'dm' && channel1.type !== 'dm') {
				const i = this.getChannelIndex(channel0.id);
				if (i > -1) {
					if (StowawayPermissions(channel1, client.user)) {
						this.#data[i].id = channel1.id;
						this.#data[i].name = channel1.name;
					}
					else {
						db.remove({ favorite_id: this.#data[i].id });
						this.#data.splice(i, 1);
					}
					this.emit('update');
				}
			}
			else if (channel0.type !== 'dm') {
				const i = this.getChannelIndex(channel0.id);
				if (i > -1) {
					db.remove({ favorite_id: this.#data[i].id });
					this.#data.splice(i, 1);
					this.emit('update');
				}
			}
		});
		client.on('guildMemberUpdate', (user0, user1) => {
			if (user0.id === client.user.id) {
				const channelIds = this.#data.filter(({ serverId }) => serverId === user0.guild.id).map(x => x.id);
				Promise.all(channelIds.map(id => client.channels.fetch(id, false)))
				.then(channels => {
					let i;
					channels.filter(channel => !StowawayPermissions(channel, user1))
					.each(channel => {
						i = this.getChannelIndex(channel.id);
						if (i > -1) {
							db.remove({ favorite_id: this.#data[i].id });
							this.#data.splice(i, 1);
						}
					});
					this.emit('update');
				});
			}
		});
	}

	#initStowaway (stowaway) {
		stowaway.on('handshake channel', (serverId, channelId) => {
			const server = this.#data.find(({ id }) => id === serverId);
			if (server === undefined) {
				throw Error(`Error in Servers.#stowawaySubscriptions() on 'handhshake channel'; serverId argument: ${serverId}`);
			}
			const channel = server.find(({ id }) => id === channelId);
			if (channel !== undefined) {
				throw Error(`Error in Servers.#stowawaySubscriptions() on 'handhshake channel'; channelId argument: ${channelId}`);
			}
			this.emit('update');
		});
	}

	#sortChannels () {
		this.#data.sort((a, b) => {
			if (a.serverId < b.serverId) {
				return -1;
			}
			else if (a.serverId > b.serverId) {
				return 1;
			}
			else {
				return a.channelId < b.channelId ? -1 : 1;
			}
		});
	}
}

module.exports = ChannelsModel;
