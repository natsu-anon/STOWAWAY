const Mediator = require('./mediator.js');
const ChannelNavigator = require('./channel-navigator.js');

// really more of a wrapper but w/e
class HandshakedMediator extends Mediator {

	constructor (model, channels) {
		super();
		this.model = model;
		this.displayChannel = function (channel) {
			const doc = channels.findOne({ channel_id: channel.id });
			if (doc != null) {
				if (doc.favorite_number != null) {
					return `{black-fg}{green-bg} ${doc.favorite_number} {white-fg}{black-bg}#${channel.name}`;
				}
				else {
					return `#${channel.name}`;
				}
			}
			else {
				return `{yellow-fg}#${channel.name} (${channel.id}){yellow-fg}`;
			}
		};
		this.readingId = null;
		this._navigator = new ChannelNavigator(model.struct, navigator => {
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
			this._navigator.checkIndex();
			this.emit('udpdate', this.text);
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
					temp = this.displayChannel(data[i]);
					if (data[i].id === this.readingId) {
						temp = `{inverse}${temp}{/inverse}`;
					}
					if (i === this._navigator.index) {
						temp = `\t{inverse}>{/inverse} ${temp}`;
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
			return 'Press [H] to handshake & add a channel';
		}
	}

	get percentage () {
		return this._navigator.percentage;
	}

	get numChannels () {
		return this.model.struct.numChannels();
	}

	read (channelId) {
		this.readingId = channelId;
		this.emit('update', this.text);
	}

	channelId () {
		const data = this._navigator.channel;
		if (data != null) {
			return data.id;
		}
	}

	favoriteId (number) {
		return new Promise(resolve => {
			resolve(this.model.getFavorite(number));
		});
	}

	toChannel (channelId) {
		if (this._navigator.find(channelId)) {
			this.emit('update', this.text);
		}
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
	setFavorite (number, channelId) {
		this.model.setFavorite(channelId, number);
	}

	clearFavorite (channelId) {
		this.model.clearFavorite(channelId);
	}
}

module.exports = HandshakedMediator;
