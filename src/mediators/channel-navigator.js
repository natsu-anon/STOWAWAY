class ChannelNavigator {
	#model;
	#index;

	constructor (model, initIndex) {
		this.#model = model;
		this.#index = initIndex();
	}

	get index () {
		return this.#index;
	}

	set index (value) {
		this.#index = value;
	}

	get #data () {
		return this.#model.data;
	}

	get channel () {
		if (this.#index != null) {
			return this.#data[this.#index];
		}
		else {
			return null;
		}
	}

	find (channelId) {
		const i = this.#data.findIndex(({ id }) => {
			return id === channelId;
		});
		if (i >= 0) {
			this.#index = i;
			return true;
		}
		else {
			this.#index = null;
			return false;
		}
	}

	scrollChannels (nextFlag) {
		return nextFlag ? this.#nextChannel() : this.#prevChannel();
	}

	scrollServers (nextFlag) {
		return nextFlag ? this.#nextServer() : this.#prevServer();
	}

	#nextChannel () {
		if (this.#data.length > 0) {
			this.#index = ++this.#index % this.#data.length;
			return true;
		}
		else {
			return false;
		}
	}

	#prevChannel () {
		if (this.#data.length > 0) {
			this.#index = --this.#index > -1 ? this.#index : this.#data.length - 1;
			return true;
		}
		else {
			return false;
		}
	}

	#nextServer () {
		if (this.#data.length > 0) {
			if (this.#index === this.#data.length - 1) {
				this.#index = 0;
			}
			else if (this.#index != null) {
				this.#index = this.#data.findIndex(({ serverId }) => {
					return serverId !== this.#data[this.#index].serverId;
				}, this.#index);
				this.#index = this.#index > -1 ? this.#index : 0;
			}
			else {
				this.#index = 0;
			}
			return true;
		}
		else {
			return false;
		}
	}

	#prevServer () {
		if (this.#data.length > 0) {
			if (this.#index === 0) {
				this.#index = this.#data.findIndex(({ serverId }) => {
					return serverId === this.#data[this.#data.length - 1].serverId;
				});
			}
			else if (this.#index != null) {
				const serverId = this.#data[this.#index].serverId;
				for (let i = this.#index - 1; i > -1; i--) {
					if (this.#data[i].serverId !== serverId) {
						this.#index = this.#data.findIndex(({ serverId }) => {
							return serverId === this.#data[i].serverId;
						});
						return true;
					}
				}
				this.#index = this.#data.findIndex(({ serverId }) => {
					return serverId === this.#data[this.#data.length - 1].serverId;
				});
			}
			else {
				this.#index = 0;
			}
			return true;
		}
		else {
			return false;
		}
	}
}

module.exports = ChannelNavigator;
