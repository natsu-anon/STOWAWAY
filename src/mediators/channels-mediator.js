const Mediator = require('./mediator.js');
const ChannelNavigator = require('./channel-navigator.js');

function displayChannel (channel) {
	if (channel.permissions.valid) {
		return `#${channel.name}`;
	}
	else {
		let res = `{red-fg}#${channel.name}; LACKING PERMISSIONS:`;
		if (!channel.permissions.viewable) {
			res += ' {underline}VIEW CHANNEL{/underline}';
		}
		if (!channel.permissions.sendable) {
			res += ' {underline}MESSAGE CHANNEL{/underline}';
		}
		if (!channel.permissions.readable) {
			res += ' {underline}READ MESSAGE HISTORY{/underline}';
		}
		res += '{/}';
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

	get content () {
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
		return res;
	}

	get index () {
		return this.#navigator.index;
	}

	get text () {
		if (this.#model.data.length > 0) {
			return this.content.join('\n');
		}
		else {
			return 'No channels available!  Add your bot to a server!';
		}
	}

	get length () {
		return this.#model.data.length;
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
