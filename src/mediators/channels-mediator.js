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
	#navigator;

	constructor (model) {
		super();
		this.model = model;
		this.#navigator = new ChannelNavigator(model.struct, navigator => {
			for (let i = 0; i < model.struct.data.length; i++) {
				if (model.struct.data[0].channels.length > 0) {
					navigator.setPosition(i, 0);
					return i + 1;
				}
			}
		});
		model.on('update', () => {
			if (this.#navigator.index > model.data.length - 1) {
				this.#navigator.scrollChannels(false);
			}
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
				else if (i === this.#navigator.index) {
					res.push(`\t> {inverse}${displayChannel(data[i])}{/inverse}`);
				}
				else {
					res.push(`\t${displayChannel(data[i])}`);
				}
			}
			return res.jon('\n');;
		}
		else {
			return 'No text channels! Add your bot to a server!';
		}
	}

	get percentage () {
		return this.#navigator.percentage;
	}

	get numChannels () {
		return this.model.struct.numChannels();
	}

	channelData () {
		const data = this.#navigator.channel;
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
		if (this.#navigator.scrollChannels(nextFlag)) {
			this.emit('update', this.text);
		}
	}

	scrollServers (nextFlag) {
		if (this.#navigator.scrollServers(nextFlag)) {
			this.emit('update', this.text);
		}
	}
}

module.exports = ChannelsMediator;
