const Model = require('./model.js');
const { Permissions } = require('../stowaway.js');
const ServerChannel = require('./server-channel-struct.js');

function channelData (channel) {
	return {
		id: channel.id,
		name: channel.name,
		// guildId: channel.guild.id,
	};
}

function serverData (guild) {
	return {
		id: guild.id,
		name: guild.name,
	};
}

function idSort (data) {
	data.sort((a, b) => (a < b ? -1 : 1));
}

function serverIndex (guild, data) {
	return data.findIndex(({ id }) => guild.id === id);
}

class HandshakedModel extends Model {
	#favorites;
	#launchChannel;

	constructor () {
		super();
		this.#favorites = {};
		this.struct = new ServerChannel({
			data: serverData,
			index: serverIndex,
			sort: idSort
		},
		{
			data: channelData,
			index: (channel, data) => {
				const i = serverIndex(channel.guild, data);
				if (i >= 0) {
					return { i, j: data[i].channels.findIndex(({ id }) => channel.id === id) };
				}
				else {
					return { i, j: -1 };
				}
			},
			sort : idSort
		});
	}

	get launchChannel () {
		return this.#launchChannel;
	}

	async initialize (stowaway, client, db) {
		this.db = db;
		await this.#initCache(client, db);
		this.#initClient(client, db);
		this.#initStowaway(stowaway);
		this.#launchChannel = await this.#getLaunchChannel(db);
		return this;
	}

	setFavorite (channelId, number) {
		if (this.#favorites[number] != null) {
			this.struct.withChannel(this.#favorites[number], data => {
				delete data.favoriteNumber;
				return data;
			});
		}
		const channel = this.struct.findChannel(channelId);
		if (channel != null) {
			this.#favorites[number] = channelId;
			this.struct.withChannel(channelId, data => {
				data.favoriteNumber = number;
				return data;
			});
			this.db.update({ favorite_number: number }, { $unset: { favorite_number: true } }, {}, err => {
				if (err != null) {
					throw err;
				}
				else {
					this.db.update({ channel_id: channelId }, { $set: { favorite_number: number } });
					this.emit('update');
				}
			});
		}
	}

	clearFavorite (channelId, emitFlag=true) {
		for (const number in this.#favorites) {
			if (this.#favorites[number] === channelId) {
				delete this.#favorites[number];
				this.struct.withChannel(channelId, data => {
					delete data.favoriteNumber;
					return data;
				});
				this.db.update({ channel_id: channelId }, { $unset: { favorite_number: true } }, {}, err => {
					if (err != null) {
						throw err;
					}
					else if (emitFlag){
						this.emit('update');
					}
				});
			}
		}
	}

	getFavorite (number) {
		return this.#favorites[number];
	}

	// getChannel (channelId) {
	// 	return this.#data.find(({ id }) => id === channelId );
	// }

	// getChannelIndex (channelId) {
	// 	return this.#data.findIndex(({ id }) => id === channelId);
	// }

	// should not be this class's responsibility to determine the launch channel but here it is
	#getLaunchChannel (db) {
		return new Promise((resolve, reject) => {
			db.findOne({ last_channel: { $exists: true } }, (err, doc) => {
				if (err != null) {
					reject(err);
				}
				else if (doc != null) {
					let fallback = true;
					for (let i = 0; i < this.struct.data.length; i++) {
						for (let j = 0; j < this.struct.data[i].channels.length; j++) {
							if (this.struct.data[i].channels[j].id === doc.last_channel) {
								// throw Error(this.struct.data[i].channels[j].id);
								fallback = false;
								resolve(doc.last_channel);
							}
						}
					}
					// resolve(this.struct.firstChannel());
					// for (let i = 0; i < this.struct.data.length; i++) {
					// 	for (let j = 0; i < this.struct.data[i].channels.length; j++) {
					// 		if (this.struct.data[i].channels[j].id === doc.last_channel) {
					// 			resolve(doc.last_channel);
					// 			fallback = false;
					// 		}
					// 	}
					// }
					if (fallback) {
						resolve(this.struct.firstChannel());
					}
				}
				else {
					resolve(this.struct.firstChannel());
				}
			});
		});
	}

	#initCache (client, db) {
		return new Promise((resolve, reject) => {
			db.find({ channel_id: { $exists: true }, handshake_id: { $exists: true } }, (err, docs) => {
				if (err != null) {
					reject(err);
				}
				else {
					Promise.all(docs.map(x => {
						return new Promise((res, rej) => {
							client.channels.fetch(x.channel_id)
							.then(channel => {
								if (!channel.deleted && Permissions(channel, client.user).valid) {
									this.struct.addChannel(channel);
									if (x.favorite_number != null) {
										this.favorites[x.favorite_number] = x.channel_id;
									}
								}
								res();
							})
							.catch(rej);
						});
					}))
					.then(() => {
						resolve();
					})
					.catch(reject);
				}
			});
		});
	}

	#initClient (client, db) {
		client.on('guildDelete', guild => {
			if (this.struct.removeServer(guild)) {
				this.emit('update');
			}
		});
		client.on('guildUpdate', (guild0, guild1) => {
			if (this.struct.guildUpdate(guild0, guild1)) {
				this.emit('update');
			}
		});
		client.on('channelDelete', channel => {
			if (this.struct.removeChannel(channel)) {
				this.emit('update');
			}
		});
		client.on('channelUpdate', (channel0, channel1) => {
			if (channel0.type !== 'dm' && channel0.isText()) {
				if (this.struct.containsChannel(channel0)) {
					if (Permissions(channel1, client.user).valid) {
						if (this.struct.updateChannel(channel0, channel1)) {
							this.emit('update');
						}
					}
					else {
						// NOTE Stowaway does the db work
						if (this.struct.removeChannel(channel0)) {
							this.clearFavorite(channel0.id, false);
							this.emit('update');
						}
					}
				}
			}
		});
		client.on('guildMemberUpdate', (user0, user1) => {
			if (user0.id === client.user.id) {
				user1.guild.channels.cache.each(channel => {
					if (!Permissions(channel, user1).valid) {
						this.db.update({ channel_id: channel.id }, { $unset: { favorite_number: true } });
					}
				});
				this.emit('update');
			}
		});
	}

	#initStowaway (stowaway) {
		stowaway.on('handshake channel', channel => {
			this.struct.addChannel(channel);
			this.emit('update');
		});
	}
}

module.exports = HandshakedModel;
