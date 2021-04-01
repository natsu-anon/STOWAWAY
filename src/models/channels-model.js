const { Model } = require('./model.js');
const { Permissions } = require('./stowaway.js');

function channelData (channel, user) {
	return {
		id: channel.id,
		name: channel.name,
		serverId: channel.guild.id,
		serverName: channel.guild.name,
		permissions: Permissions(channel, user)
	};
}

class ChannelsModel extends Model {
	#data;

	constructor () {
		super();
		this.#data = [];
	}

	get data () {
		return this.#data;
	}

	// called when a channel is handshaked--Stowaway.on('handshake', channelId)
	removeChannel (channelId) {
		const i = this.#data.findIndex(({ id }) => id === channelId);
		if (i >= 0) {
			this.#data.splice(i, 1);
			this.emit('update');
		}
	}

	initialize (client, db) {
		// make sure db doesn't have
		return Promise((resolve, reject) => {
			client.on('channelCreate', channel => {
				if (channel.type !== 'dm') {
					this.#data.push(channelData(channel));
					this.#sortChannels();
					this.emit('update');
				}
			});
			client.on('channelDelete', channel => {
				if (channel.type !== 'dm') {
					const i = this.#data.findIndex(({ id }) => id === channel.id);
					if (i >= 0) {
						this.#data.splice(i, 1);
						this.emit('update');
					}
				}
			});
			client.on('channelUpdate', (channel0, channel1) => {
				if (channel0.type !== 'dm' && channel1.type !== 'dm') {
					const i = this.#data.findIndex(({ id }) => id === channel0.id);
					if (i >= 0) {
						this.#data[i] = channelData(channel1, client.user);
						this.emit('update');
					}
				}
			});
			db.find({ channel_id: { $exists: true }, handshake_id: { $exists: true } }, (err, docs) => {
				if (err != null) {
					reject(err);
				}
				else {
					this.#data = client.channels.cache.filter(ch => ch.type !== 'dm')
					.filter(ch => {
						return docs.findIndex(({ channel_id }) => ch.id === channel_id) === -1;
					}).map(ch => channelData(ch, client.user));
					resolve(this);
				}
			});
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
