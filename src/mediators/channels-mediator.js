const Mediator = require('./mediator.js');
const ChannelNavigator = require('./channel-navigator.js');

function displayChannel (channel) {
	if (channel.permissions.valid) {
		return `#${channel.name}`;
	}
	else {
		const channelName = `{red-fg}#${channel.name}; LACKING PERMISSIONS:`;
		const permissions = [];
		if (!channel.permissions.viewable) {
			permissions.push('{underline}VIEW CHANNEL{/underline}');
		}
		if (!channel.permissions.sendable) {
			permissions.push('{underline}MESSAGE CHANNEL{/underline}');
		}
		if (!channel.permissions.readable) {
			permissions.push('{underline}READ MESSAGE HISTORY{/underline}');
		}
		return `${channelName} ${permissions.join(', ')}{/}`;
	}
}

class ChannelsMediator extends Mediator {

	constructor (model, invite) {
		super();
		this.model = model;
		this.invite = invite;
		this._navigator = new ChannelNavigator(model.struct, navigator => {
			for (let i = 0; i < model.struct.data.length; i++) {
				if (model.struct.data[0].channels.length > 0) {
					navigator.setPosition(i, 0);
					return i + 1;
				}
			}
		});
		model.on('update', () => {
			this._navigator.checkIndex();
			this.emit('update', this.text);
		});
	}

	get text () {
		if (this.model.struct.numChannels() > 0) {
			const res = [];
			const data = this.model.struct.flatten();
			for (let i = 0; i < data.length; i++) {
				if (data[i].server) {
					res.push(`{underline}${data[i].name}{/underline}`);
				}
				else if (i === this._navigator.index) {
					if (data[i].permissions.valid) {
						res.push(`\t{inverse}>{/inverse} ${displayChannel(data[i])}`);
					}
					else {
						res.push(`\t{red-bg}{black-fg}X{/} ${displayChannel(data[i])}`);
					}
				}
				else {
					res.push(`\t${displayChannel(data[i])}`);
				}
			}
			return res.join('\n');;
		}
		else {
			return `No text channels! Add your bot to a server!\nlink: {underline}${this.invite}{/underline}`;
		}
	}

	get percentage () {
		return this._navigator.percentage;
	}

	get numChannels () {
		return this.model.struct.numChannels();
	}

	channelData () {
		const data = this._navigator.channel;
		if (data != null) {
			return {
				id: data.id,
				valid: data.permissions.valid
			};
		}
	}

	removeChannel(channelId) {
		this.model.removeChannel(channelId);
	}

	scrollChannels (nextFlag) {
		if (this._navigator.scrollChannels(nextFlag)) {
			this.emit('update', this.text);
		}
	}

	scrollServers (nextFlag) {
		if (this._navigator.scrollServers(nextFlag)) {
			this.emit('update', this.text);
		}
	}
}

module.exports = ChannelsMediator;
