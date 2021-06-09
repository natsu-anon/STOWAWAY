const Model = require('./model.js');
const { Permissions } = require('../stowaway.js');
const ServerChannel = require('./server-channel-struct.js');

function channelData (channel) {
	return {
		id: channel.id,
		name: channel.name,
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

	async initialize (stowaway, client, channels) {
		this.channels = channels;
		await this._initCache(client, channels);
		this._initClient(client, channels);
		this._launchChannel = stowaway.lastChannel;
		this._initStowaway(stowaway);
		return this;
	}

	setFavorite (channelId, number) {
		this.channels.findAndUpdate({ favorite_number: number }, doc => {
			delete doc.favorite_number;
		});
		this.channels.findAndUpdate({ channel_id: channelId }, doc => {
			doc.favorite_number = number;
			this.emit('update');
		});
	}

	clearFavorite (channelId, emitFlag=true) {
		this.channels.findAndUpdate({ channel_id: channelId, favorite_number: { $exists: true } }, doc => {
			delete doc.favorite_number;
			if (emitFlag) {
				this.emit('update');
			}
		});
	}

	getFavorite (number) {
		const res = this.channels.findOne({ favorite_number: number });
		return res != null ? res.channel_id : null;
	}

	_initCache (client, channels) {
		return new Promise((resolve, reject) => {
			Promise.all(channels.data.map(doc => client.channels.fetch(doc.channel_id, false)))
			.then(results => {
				results.forEach(channel => { this.struct.addChannel(channel); });
				resolve();
			})
			.catch(reject);
		});
	}

	_initClient (client) {
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
						if (this.struct.removeChannel(channel0)) {
							this.clearFavorite(channel0.id, false);
							this.emit('update');
						}
					}
				}
			}
		});
		client.on('guildMemberUpdate', (member0, member1) => {
			if (member0.id === client.user.id) {
				member1.guild.channels.cache.each(channel => {
					if (!Permissions(channel, member1.user).valid) {
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
