const Mediator = require('./mediator.js');
const ChannelNavigator = require('./channel-navigator.js');

function displayChannel (channel) {
	if (channel.permissions.valid) {
		return `#${channel.name}`;
	}
	else {
		let res = `{red-fg}#${channel.name}{/red-fg}`;
		if (!channel.permissions.viewable) {
			res += '\n\t\t{red-fg}- CANNOT VIEW CHANNEL{/red-fg}';
		}
		if (!channel.permissions.sendable) {
			res += '\n\t\t{red-fg}- CANNOT MESSAGE CHANNEL{/red-fg}';
		}
		if (!channel.permissions.readable) {
			res += '\n\t\t{red-fg}- CANNOT READ MESSAGE HISTORY{/red-fg}';
		}
		return res;
	}

}

class ChannelsMediator extends Mediator {
	#model;
	#navigator;

	constructor (model) {
		super();
		this.#model = model;
		this.#navigator = new ChannelNavigator(model, () => {
			return model.data.length > 0 ? 0 : null;
		});
		model.on('update', () => {
			if (this.#navigator.index > model.data.length - 1) {
				this.#navigator.index = model.data.length - 1;
			}
			this.emit('update', this.text);
		});
	}

	get text () {
		if (this.#model.data.length > 0) {
			const res = [];
			for (let i = 0; i < this.#model.data.length; i++) {
				if (i === 0 || this.#model.data[i - 1 ].serverId !== this.#model.data[i].serverId) {
					res.push(`{underline}${this.#model.data[i].serverName}{/underline}`);
				}
				if (i === this.#navigator.index) {
					res.push(`\t> {inverse}${displayChannel(this.#model.data[i])}{/inverse}`);
				}
				else {
					res.push(`\t${displayChannel(this.#model.data[i])}`);
				}
			}
			return res.join('\n');
		}
		else {
			return 'No channels available!  Add your bot to a server!';
		}
	}

	get hasChannels () {
		return this.#model.data.length > 0;
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
		this.#model.removeChannel(channelId);
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
