const Mediator = require('./mediator.js');
const ChannelNavigator = require('./channel-navigator.js');

function displayChannel (channel, db) {
	return new Promise((resolve, reject) => {
		db.findOne({ channel_id: channel.id }, (err, doc) => {
			if (err != null) {
				reject(err);
			}
			else if (doc != null) {
				if (doc.favorite_number != null) {
					resolve(`{black-fg}{green-bg} ${doc.favorite_number} {white-fg}{black-bg}#${channel.name}`);
				}
				else {
					resolve(`#${channel.name}`);
				}
			}
			else {
				resolve(`{yellow-fg}#${channel.name} (${channel.id}){/yellow-fg}`);
			}
		});
	});
	/*
	if (channel.favoriteNumber != null) { // NOTE: channel cannot be
		return `{green-fg}[${channel.favoriteNumber}] #${channel.name}{/green-fg}`;
	}
	else {
		return `#${channel.name}`;
	}
	*/
}

// really more of a wrapper but w/e
class HandshakedMediator extends Mediator {

	constructor (model, db) {
		super();
		this.model = model;
		this.db = db;
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
			this.representation().then(text => {
				this.emit('update', text);
			});
			//this.emit('update', await this.representation());
		});
	}

	/* NO
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
			return 'Press [E] to handshake & add a channel';
		}
	}
	*/

	get percentage () {
		return this._navigator.percentage;
	}

	get numChannels () {
		return this.model.struct.numChannels();
	}

	read (channelId) {
		this.readingId = channelId;
		this.representation().then(text => {
			this.emit('update', text);
		});
	}

	channelId () {
		const data = this._navigator.channel;
		if (data != null) {
			return data.id;
		}
	}

	toFavorite (number) {
		return new Promise((resolve, reject) => {
			this.db.findOne({ favorite_number: number }, (err, doc) => {
				if (err != null) {
					reject(err);
				}
				else if (doc != null) {
					resolve(doc.channel_id);
				}
				else {
					resolve();
				}
			});
		});
		/*
		const channelId = this.model.getFavorite(number);
		if (channelId != null) {
			if (this._navigator.find(channelId)) {
				this.emit('update', this.text);
				return channelId;
			}
		}
		*/
	}

	toChannel (channelId) {
		if (this._navigator.find(channelId)) {
			this.emit('update', this.text);
		}
	}

	async representation () {
		if (this.model.struct.numChannels() > 0) {
			const res = [];
			const data = this.model.struct.flatten();
			let temp = '';
			for (let i = 0; i < data.length; i++) {
				if (data[i].server) {
					res.push(`{underline}${data[i].name}{/underline}`);
				}
				else {
					temp = await displayChannel(data[i], this.db);
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

	scrollChannels (nextFlag) {
		if (this._navigator.scrollChannels(nextFlag)) {
			this.representation().then(text => {
				this.emit('update', text);
			});
		}
	}

	scrollServers (nextFlag) {
		if (this._navigator.scrollServers(nextFlag)) {
			this.representation().then(text => {
				this.emit('update', text);
			});
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
