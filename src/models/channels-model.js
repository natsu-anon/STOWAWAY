const Model = require('./model.js');

const VIEW = 'VIEW_CHANNEL';
const SEND = 'SEND_MESSAGES';
const READ = 'READ_MESSAGE_HISTORY';

function stowawayPermissions (channel, user) {
	const permissions = channel.permissionsFor(user);
	return permissions.has(VIEW) && permissions.has(SEND) && permissions.has(READ);
}

function channelData (channel) {
	return {
		id: channel.id,
		name: channel.name,
		topic: channel.topic,
		serverId: channel.guild.id,
		serverName: channel.guild.name,
		handshaked: false
	};
}

class ChannelsModel extends Model {
	#data;

	constructor () {
		super();
		this.#data = [];
	}

	async initialize (stowaway, client, db) {
		await this.#initCache(client, db);
		this.#initClient(client);
		this.#initStowaway(stowaway);
		return await this.#launchChannel(db);
	}

	setFavorite (channelId, number, db) {
		return new Promise((resolve, reject) => {
			let channel = this.#data.find(({ favoriteNumber }) => favoriteNumber === number);
			if (channel !== undefined) {
				channel.favoriteNumber = null;
			}
			channel = this.#getChannel(channelId);
			if (channel !== undefined) {
				if (channel.handshaked) {
					channel.favoriteNumber = number;
					db.update({ favorite: number }, { favorite_id: channelId, favorite_number: number }, { upsert: true });
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

	#getChannel (channelId) {
		return this.#data.find(({ id }) => id === channelId);
	}

	#getChannelIndex (channelId) {
		return this.#data.findIndex(({ id }) => id === channelId);
	}

	#launchChannel (db) {
		return new Promise((resolve, reject) => {
			db.findOne({ last_channel: { $exists: true } }, (_, doc) => {
				if (doc != null) {
					const channel = this.#getChannel(doc.channel_id);
					if (channel !== undefined) {
						resolve(channel.id);
						return;
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

	#initCache (client, db) {
		client.guilds.cache.each(guild => {
			guild.channels.cache.filter(channel => channel.isText())
			.each(channel => {
				if (stowawayPermissions(channel, client.user)) {
					this.#data.push(channelData(channel));
				}
			});
		});
		return new Promise((resolve, reject) => {
			let channel;
			new Promise(res => {
				db.find({ favorite_id: { $exists: true } }, (err, docs) => {
					if (err != null) {
						throw err;
					}
					else {
						docs.forEach(doc => {
							channel = this.#getChannel(doc.favorite_id);
							if (channel !== undefined) {
								channel.favoriteNumber = doc.favorite_number;
							}
						});
						res();
					}
				});
			})
			.then(() => {
				db.find({ channel_id: { $exists: true } }, (err, docs) => {
					if (err != null) {
						throw err;
					}
					else {
						docs.forEach(doc => {
							channel = this.#getChannel(doc.channel_id);
							if (channel !== undefined) {
								channel.handshaked = true;
							}
							// o.w. don't sweat it
						});
						resolve();
					}
				});
			})
			.catch(reject);
		});
	}

	#initClient (client) {
		client.on('guildCreate', server => {
			server.channels.cache.filter(channel => channel.isText() && stowawayPermissions(channel, client.user))
			.each(channel => {
				this.#data.push(channelData(channel));
			});
			this.emit('update');
		});
		client.on('guildDelete', server => {
			// RETVRN TO TRADITION
			for (let i = this.#data.length - 1; i >= 0; i--) {
				if (this.#data[i].serverId === server.id) {
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
		client.on('channelCreate', channel => {
			if (channel.type !== 'dm') {
				if (channel.isText() && stowawayPermissions(channel, client.user)) {
					this.#data.push(channelData(channel));
					this.emit('update');
				}
			}
		});
		client.on('channelDelete', channel => {
			if (channel.type !== 'dm') {
				const index = this.#getChannelIndex(channel.id);
				if (index >= 0) {
					this.#data.splice(index, 1);
					this.emit('update');
				}
			}
		});
		client.on('channelUpdate', (channel0, channel1) => {
			if (channel0.type !== 'dm' && channel1.type !== 'dm') {
				const i = this.#getChannelIndex(channel0.id);
				if (i > -1) {
					if (stowawayPermissions(channel1, client.user)) {
						this.#data[i].id = channel1.id;
						this.#data[i].name = channel1.name;
						this.#data[i].topic = channel1.topic;
					}
					else {
						this.#data.splice(i, 1);
					}
					this.emit('update');
				}
			}
			else if (channel0.type !== 'dm') {
				const i = this.#getChannelIndex(channel0.id);
				if (i >= 0) {
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
					channels.filter(channel => !stowawayPermissions(channel, user1))
					.each(channel => {
						i = this.#getChannelIndex(channel.id);
						if (i > -1) {
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
			channel.handhsaked = true;
			this.emit('update');
		});
	}
}

module.exports = ChannelsModel;
