const Model = require('./model.js');
const { Permissions } = require('../stowaway.js');
const ServerChannel = require('./server-channel-struct.js');

function serverData (guild) {
	return {
		id: guild.id,
		name: guild.name,
	};
}

function channelData (channel, user) {
	return {
		id: channel.id,
		name: channel.name,
		permissions: Permissions(channel, user)
	};
}

function idSort (data) {
	data.sort((a, b) => (a < b ? -1 : 1));
}

function serverIndex (guild, data) {
	return data.findIndex(({ id }) => guild.id === id);
}

class ChannelsModel extends Model {

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

	initialize (stowaway, client, channels) {
		client.on('guildCreate', guild => {
			guild.channels.cache.filter(ch => ch.isText()).each(ch => {
				this.struct.addChannel(ch);
			});
			this.emit('update');
		});
		client.on('guildDelete', guild => {
			if (this.struct.removeServer(guild)) {
				this.emit('update');
			}
		});
		client.on('guildUpdate', (guild0, guild1) => {
			if (this.struct.updateServer(guild0, guild1)) {
				this.emit('update');
			}
		});
		client.on('channelCreate', channel => {
			if (channel.type !== 'dm' && channel.isText()) {
				this.struct.addChannel(channel);
			}
		});
		client.on('channelDelete', channel => {
			if (this.struct.removeChannel(channel)) {
				this.emit('update');
			}
		});
		client.on('channelUpdate', (channel0, channel1) => {
			if (this.struct.updateChannel(channel0, channel1)) {
				this.emit('update');
			}
		});
		client.on('guildMemberUpdate', (user0, user1) => {
			if (user0.id === client.user.id) {
				user0.guild.channels.cache.filter(ch => ch.isText())
				.each(channel => {
					if (this.struct.containsChannel(channel)) {
						if (!Permissions(channel, user1).valid) {
							this.struct.removeChannel(channel);
						}
					}
					else if (Permissions(channel, user1).valid) {
							this.struct.addChannel(channel);
					}
				});
				this.emit('update');
			}
		});
		stowaway.on('handshake channel', channel => {
			if (this.struct.removeChannel(channel)) {
				this.emit('update');
			}
			else {
				throw Error('server-channel struct mismatch in channel-models.js, on stowaway.emit("handshakeChannel")');
			}
		});
		const handshakedIds = channels.data.map(doc => doc.channel_id);
		client.channels.cache.filter(ch => !handshakedIds.includes(ch.id) && ch.type !== 'dm' && ch.isText())
		.each(channel => {
			this.struct.addChannel(channel, client.user);
		});
		return Promise.resolve(this);
	}
}

module.exports = ChannelsModel;
