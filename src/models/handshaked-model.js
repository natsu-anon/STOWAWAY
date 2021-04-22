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

	constructor () {
		super();
		this._favorites = {};
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
		return this._launchChannel;
	}

	async initialize (stowaway, client, db) {
		this.db = db;
		await this._initCache(client, db);
		this._initClient(client, db);
		this._initStowaway(stowaway);
		this._launchChannel = await this._getLaunchChannel(db);
		return this;
	}

	async setFavorite (channelId, number) {
		// await this.clearFavorite(channelId, false);
		await new Promise((resolve, reject) => {
			this.db.update({ favorite_number: number }, { $unset: { favorite_number: number } }, {}, err => {
				if (err != null) {
					reject(err);
				}
				else {
					resolve();
				}
			});
		});
		this.db.update({ channel_id: channelId }, { $set: { favorite_number: number } }, {}, (err, numAffected) => {
			if (err != null) {
				throw err;
			}
			else if (numAffected > 0) {
				this.emit('update');
			}
		});
		/*
		const channel = this.struct.findChannel(channelId);
		if (channel != null) {
			if (this._favorites[number] != null) {
				delete this._favorites[number];
				this.struct.withChannel(temp, data => {
					delete data.favoriteNumber;
					return data;
				});
				const temp = this._favorites[number];
				await this.clearFavorite(temp, false);
			}
			this._favorites[number] = channelId;
			this.struct.withChannel(channelId, data => {
				data.favoriteNumber = number;
				return data;
			});
			this.db.update({ channel_id: channelId }, { $set: { favorite_number: number } }, {}, err => {
				if (err != null) {
					throw err;
				}
				else {
					this.emit('update');
				}
			});
		}
		*/
	}

	clearFavorite (channelId, emitFlag=true) {
		return new Promise((resolve, reject) => {
			this.db.update({ channel_id: channelId }, { $unset: { favorite_number: true } }, {}, (err, numAffected) => {
				if (err != null) {
					reject(err);
				}
				else {
					if (emitFlag && numAffected > 0) {
						this.emit('update');
					}
					resolve();
				}
			});
		});
		/*
		for (const number in this._favorites) {
			if (this._favorites[number] === channelId) {
				return new Promise((resolve, reject) => {
					delete this._favorites[number];
					this.struct.withChannel(channelId, data => {
						delete data.favoriteNumber;
						return data;
					});
					this.db.update({ channel_id: channelId }, { $unset: { favorite_number: true } }, {}, err => {
						if (err != null) {
							reject(err);
						}
						else {
							if (emitFlag) {
								this.emit('update');
							}
							resolve();
						}
					});
				});
			}
		}
		return Promise.resolve();
		*/
	}

	getFavorite (number) {
		return this._favorites[number];
	}

	// getChannel (channelId) {
	// 	return this._data.find(({ id }) => id === channelId );
	// }

	// getChannelIndex (channelId) {
	// 	return this._data.findIndex(({ id }) => id === channelId);
	// }

	// should not be this class's responsibility to determine the launch channel but here it is
	_getLaunchChannel (db) {
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

	_initCache (client, db) {
		return new Promise((resolve, reject) => {
			db.find({ channel_id: { $exists: true } }, (err, docs) => {
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
									/*
									if (x.favorite_number != null) {
										this._favorites[x.favorite_number] = x.channel_id;
									}
									*/
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

	_initClient (client, db) {
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

	_initStowaway (stowaway) {
		stowaway.on('handshake channel', channel => {
			this.struct.addChannel(channel);
			this.emit('update');
		});
	}
}

module.exports = HandshakedModel;
