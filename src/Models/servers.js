const Model = require('./model.js');

const VIEW = 'VIEW_CHANNEL';
const SEND = 'SEND_MESSAGES';
const READ = 'READ_MESSAGE_HISTORY';

function nonDM (channel, callback) {
	if (channel.type !== 'dm') {
		callback(channel);
	}
}

function stowawayPermissions (channel, user) {
	const permissions = channel.permissionsFor(user);
	return permissions.has(VIEW) && permissions.has(SEND) && permissions.has(READ);
}

function channelData (channel) {
	return {
		id: channel.id,
		name: channel.name,
		topic: channel.topic,
		handshaked: false
	};
}

function removeChannel (server, channel) {
	const index = server.channels.findIndex(({ id }) => id === channel.id);
	if (index > -1) {
		server.channels.splice(index, 1);
	}
}

class Servers extends Model {
	#data;

	constructor () {
		super();
		this.#data = [];
	}

	async initialize (stowaway, client, db) {
		await this.#cacheCurrent(client, db);
		this.#clientSubscriptions(client);
		this.#stowawaySubscriptions(stowaway);
	}

	#cacheCurrent (client, db) {
		const channelIds = [];
		let temp;
		client.guilds.cache.each(guild => {
			temp = {
				id: guild.id,
				name: guild.name,
				channels: []
			};
			guild.channels.cache.filter(channel => channel.isText())
			.each(channel => {
				if (stowawayPermissions(channel, client.user)) {
					temp.channels.push(channelData(channel));
					channelIds.push(channel.id);
				}
			});
			if (temp.channels.length > 0) {
				this.#data.push(temp);
			}
		});
		return new Promise((resolve, reject) => {
			new Promise(res => {
				db.find({ favorite_id: { $exists: true } }, (err, docs) => {
					if (err != null) {
						throw err;
					}
					else {
						docs.forEach(doc => {
							temp = this.#data.find(({ channels }) => channels.find(({ id }) => id === doc.favorite_id) !== undefined);
							if (temp !== undefined) {
								temp.channels.find(({ id }) => id === doc.channel_id).favorite_number = document.favorite_number;
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
							temp = this.#data.find(({ channels }) => channels.find(({ id }) => id === doc.channel_id) !== undefined);
							if (temp !== undefined) {
								temp.channels.find(({ id }) => id === doc.channel_id).handshaked = true;
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

	favorite (channelId, number, db) {
		const server = this.#data(({ channels }) => channels.find(({ id }) => id === channelId));
		if (server === undefined) {
			throw Error(`Error in Servers.favorite(); channelId argument: ${channelId}`);
		}
		const channel = server.channels.find(({ id }) => id === channelId);
		if (channel.handshaked) {
			channel.jump = number;
			this.db.update({ favorite_number: number }, { favorite_id: channelId, favorite_numer: number }, { upsert: true });
			this.emit('update');
		}
		else {
			throw Error(`Error in Servers.favorite(); Cannot favorite non-handshaked channel ${channelId}!`);
		}
	}

	#clientSubscriptions (client) {
		client.on('guildCreate', server => {
			const temp = {
				id: server.id,
				name: server.name,
				channels: [],
			};
			server.channels.cache.filter(channel => channel.isText())
			.each(channel => {
				if (stowawayPermissions(channel, client.user)) {
					temp.channels.push(channelData(channel));
				}
			});
			this.#data.push(temp);
			this.emit('update');
		});
		client.on('guildDelete', server => {
			const index = this.#data.findIndex(({ id }) => id === server.id);
			if (index > -1) {
				this.#data.splice(index, 1);
			}
			this.emit('update');
		});
		client.on('guildUpdate', (server0, server1) => {
			const server = this.#data.find(({ id }) => id === server0.id);
			if (server !== undefined) {
				server.id = server1.id;
				server.name = server1.name;
				this.emit('update');
			}
		});
		client.on('channelCreate', channel => {
			nonDM(channel, channel => {
				if (channel.isText()) {
					if (stowawayPermissions(client.user)) {
						const server = this.#data.find(({ id }) => id === channel.guild.id);
						if (server === undefined) {
							this.#data.push({
								id: channel.guild.id,
								name: channel.guild.name,
								channels: [ channelData(channel) ]
							});
						}
						else {
							server.channels.push(channelData(channel));
						}
						this.emit('update');
					}
				}
			});
		});
		client.on('channelDelete', channel => {
			nonDM(channel, channel => {
				const server = this.#data.find(({ id }) => id === channel.guild.id);
				if (server !== undefined) {
					removeChannel(server, channel);
					this.emit('update');
				}
			});
		});
		client.on('channelUpdate', (channel0, channel1) => {
			if (channel0.type !== 'dm' && channel1.type !== 'dm') {
				const server = this.#data.find(({ id }) => id === channel0.guild.id);
				if (server !== undefined) {
					const channel = server.channels.find(({ id }) => id === channel0.id);
					if (channel !== undefined) {
						if (stowawayPermissions(channel1, client.user)) {
							channel.id = channel1.id;
							channel.name = channel1.name;
							channel.topic = channel1.topic;
						}
						else {
							removeChannel(server, channel0);
						}
						this.emit('update');
					}
				}
			}
		});
		client.on('guildMemberUpdate', (user0, user1) => {
			if (user0.id === client.user.id) {
				const server = this.#data.find(({ id }) => id === user0.guild.id );
				if (server !== undefined) {
					Promise.all(server.channels.map(channel => {
						client.channels.fetch(channel.id, false);
					}))
					.then(channels => {
						let flag = false;
						channels.forEach(channel => {
							if (!stowawayPermissions(channel, user1)) {
								removeChannel(server, channel);
								flag = true;
							}
						});
						if (flag) {
							this.emit('update');
						}
					});
				}
			}
		});
	}

	#stowawaySubscriptions (stowaway) {
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

module.exports = Servers;
