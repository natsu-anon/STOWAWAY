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
	#navigator;
	#readingId;

	constructor (model) {
		super();
		this.model = model;
		this.#readingId = null;
		this.#navigator = new ChannelNavigator(model.struct, navigator => {
			let index = 0;
			for (let i = 0; i < model.struct.data.length; i++) {
				index++;
				for (let j = 0; j < model.struct.data[i].channels.length; j++) {
					if (model.struct.data[i].channels[j].id === model.launchChannel) {
						navigator.setPosition(i, j);
						return index;
					}
					else {
						index++;
					}
				}
			}
		});
		model.on('update', () => {
			this.#navigator.checkIndex();
			this.emit('update', this.text);
		});
	}

	get text () {
		if (this.model.struct.numChannels() > 0) {
			const res = [];
			const data = this.model.struct.flatten();
			let temp = '';
			for (let i = 0; i < data.length; i++) {
				if (data[i].server) {
					res.push(`{underline}${data[i].name}{/underline}`);
				}
				else {
					temp = displayChannel(data[i]);
					if (data[i].id === this.#readingId) {
						temp = `{inverse}${temp}{/inverse}`;
					}
					if (i === this.#navigator.index) {
						temp = `\t> ${temp}`;
					}
					else {
						temp = `\t${temp}`;
					}
					res.push(temp);
				}
			}
			return res.join('\n');
		}
		else {
			return 'Press [E] to handshake & add a channel';
		}
	}

	get percentage () {
		return this.#navigator.percentage;
	}

	get numChannels () {
		return this.model.struct.numChannels();
	}

	read (channelId) {
		this.#readingId = channelId;
		this.emit('update', this.text);
	}

	channelId () {
		const data = this.#navigator.channel;
		if (data != null) {
			return data.id;
		}
	}

	toFavorite (number) {
		const channelId = this.model.getFavorite(number);
		if (channelId != null) {
			if (this.#navigator.find(channelId)) {
				this.emit('update', this.text);
				return channelId;
			}
		}
	}

	toChannel (channelId) {
		if (this.#navigator.find(channelId)) {
			this.emit('update', this.text);
		}
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
		this.model.setFavorite(this.channelId, number);
	}

	clearFavorite (channelId) {
		this.model.clearFavorite(channelId);
	}
}

module.exports = HandshakedMediator;
