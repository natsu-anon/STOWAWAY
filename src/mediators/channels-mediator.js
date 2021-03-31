const Mediator = require('./mediator.js');

function displayChannel (channel) {
	if (channel.favoriteNumber != null) { // NOTE: channel cannot be
		return `{green-fg}[${channel.favoriteNumber}] #${channel.name}{/green-fg}`;
	}
	else {
		return `#${channel.name}`;
	}
}

// really more of a wrapper but w/e
class ChannelsMediator extends Mediator {
	#model;
	#index;

	constructor(model) {
		super();
		this.#model = model;
		this.#index = model.data.findIndex(({ id }) => id === model.launchChannel);
		model.on('update', () => {
			if (this.#index > this.#model.data.length - 1) {
				this.#index = this.#model.data.length - 1;
			}
			this.emit('update', this.text);
		});
	}

	get index () {
		return this.#index;
	}

	// since the model sorts its data by serverId then channelId you can relax.
	get text () {
		const res = [];
		for (let i = 0; i < this.#model.data.length; i++) {
			if (i === 0 || this.#model.data[i - 1 ].serverId !== this.#model.data[i].serverId) {
				res.push(`{underline}${this.#model.data[i].serverName}{/underline}`);
			}
			if (i === this.#index) {
				res.push(`\t> {inverse}${displayChannel(this.#model.data[i])}{/inverse}`);
			}
			else {
				res.push(`\t${displayChannel(this.#model.data[i])}`);
			}
		}
		return res.join('\n');
	}

	get channelId () {
		return this.#model.data[this.#index].id;
	}

	jumpToFavorite (number) {
		return new Promise((resolve, reject) => {
			this.#model.getFavorite(number)
			.then(channelId => {
				this.#index = this.#model.getChannelIndex(channelId);
				this.emit('update', this.text);
				resolve(channelId);
			})
			.catch(reject);
		});
	}

	nextChannel () {
		this.#index = ++this.#index % this.#model.data.length;
		this.emit('update', this.text);
	}

	prevChannel () {
		this.#index = --this.#index > -1 ? this.#index : this.#model.data.length - 1;
		this.emit('update', this.text);
	}

	/* DEPRECATED
	nextHandshaked () {
		if (this.#index === this.#model.data.length - 1) {
			this.#index = this.#model.firstHandshaked();
		}
		else {
			this.#index = this.#model.data.findIndex(({ handshaked }) => handshaked, this.#index);
			this.#index = this.#index > -1 ? this.#index : this.#model.firstHandshaked();
		}
		this.emit('update', this.text);
	}

	// NOTE array reversal is NOT divinely inspired.
	prevHandshaked () {
		if (this.#index === 0) {
			this.#index = this.#model.lastHandshaked();
		}
		else {
			// RETVRN TO FOR LOOPS
			for (let i = this.#index - 1; i > -1; i--) {
				if (this.#model.data[i].handshaked) {
					this.#index = i;
					this.emit('update', this.text);
					return;
				}
			}
			this.#index = this.#model.lastHandshaked();
		}
		this.emit('update', this.text);
	}
	*/

	nextServer () {
		if (this.#index === this.#model.data.length - 1) {
			this.#index = 0;
		}
		else if (this.#index != null) {
			this.#index = this.#model.data.findIndex(({ serverId }) => {
				return serverId !== this.#model.data[this.#index].serverId;
			}, this.#index);
			this.#index = this.#index > -1 ? this.#index : 0;
		}
		else {
			this.#index = 0;
		}
		this.emit('update', this.text);
	}

	prevServer () {
		if (this.#index === 0) {
			this.#index = this.#model.data.findIndex(({ serverId }) => {
				return serverId === this.#model.data[this.#model.data.length - 1].serverId;
			});
		}
		else if (this.#index != null) {
			const serverId = this.#model.data[this.#index].serverId;
			for (let i = this.#index - 1; i > -1; i--) {
				if (this.#model.data[i].serverId !== serverId) {
					this.#index = this.#model.data.findIndex(({ serverId }) => {
						return serverId === this.#model.data[i].serverId;
					});
					this.emit('update', this.text);
					return;
				}
			}
			this.#index = this.#model.lastServer();
		}
		else {
			this.#index = 0;
		}
		this.emit('update', this.text);
	}

	setFavorite (number) {
		return this.#model.setFavorite(this.channelId, number);
	}

	clearFavorite() {
		return this.#model.clearFavorite(this.channelId);
	}
}

module.exports = ChannelsMediator;
