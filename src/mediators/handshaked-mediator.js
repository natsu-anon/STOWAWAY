const Mediator = require('./mediator.js');
const ChannelNavigator = require('./channel-navigator.js');

function displayChannel (channel) {
	if (channel.favoriteNumber != null) { // NOTE: channel cannot be
		return `{green-fg}[${channel.favoriteNumber}] #${channel.name}{/green-fg}`;
	}
	else {
		return `#${channel.name}`;
	}
}

// really more of a wrapper but w/e
class HandshakedMediator extends Mediator {
	#model;
	#navigator;

	constructor (model) {
		super();
		this.#model = model;
		this.#navigator = new ChannelNavigator(model, () => {
			const res = model.data.findIndex(({ id }) => id === model.launchChannel);
			if (res === -1) {
				return null;
			}
			else {
				return res;
			}
		});
		model.on('update', () => {
			if (this.#navigator.index > model.data.length - 1) {
				this.#navigator.index = model.data.length - 1;
			}
			this.emit('update', this.text);
		});
	}

	// since the model sorts its data by serverId then channelId you can relax.
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
			return 'Press [E] to handshake a channel';
		}
	}

	get hasChannels () {
		return this.#model.data.length > 0;
	}

	get length () {
		return this.#model.data.length;
	}

	channelId () {
		const data = this.#navigator.channel;
		if (data != null) {
			return data.id;
		}
	}

	toFavorite (number) {
		return new Promise((resolve, reject) => {
			this.#model.getFavorite(number)
			.then(channelId => {
				if (this.#navigator.find(channelId)) {
					this.emit('update', this.text);
					resolve(channelId);
				}
				else {
					throw Error(`Channel navigator could not find channelId ${channelId}`);
				}
			})
			.catch(reject);
		});
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
	setFavorite (number) {
		this.#model.setFavorite(this.channelId, number);
	}

	clearFavorite (channelId) {
		this.#model.clearFavorite(channelId);
	}
}

module.exports = HandshakedMediator;
