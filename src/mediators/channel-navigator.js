class ChannelNavigator {
	#index;
	#position;

	constructor (struct, initIndex) {
		this.struct = struct;
		this.#index = initIndex(this);
	}

	get index () {
		return this.#index;
	}

	get percentage () {
		if (this.struct.data.length === 0) {
			return 0;
		}
		else {
			return this.#index / (this.struct.data.length + this.struct.numChannels()) * 100;
		}
	}

	set index (value) {
		this.#index = value;
	}

	get data () {
		return this.struct.data;
	}

	get channel () {
		if (this.#index != null) {
			return this.data[this.#position.server].channels[this.#position.channel];
		}
		else {
			return null;
		}
	}

	setPosition (server, channel) {
		this.#position = { server, channel };
	}

	checkIndex () {
		if (this.#position === undefined) {
			this.#firstChannel();
		}
		else {
			const index = this.#position.server;
			if (index >= this.data.length) {
				this.#lastChannel();
			}
			else if (this.#position.channel >= this.data[index].channels.length) {
				if (this.data[index].channels.length > 0) {
					this.#index += (this.data[index].channels.length - 1) - this.#position.channel;
					this.#position.channel = this.data[index].channels.length - 1;
				}
				else {
					this.#firstChannel(); // KEEP IT SIMPLE
				}
			}
			else {
				let temp = 0;
				for (let i = 0; i < this.#position.server; i++) {
					temp += this.data[i].channels.length + 1;
				}
				temp += this.#position.channel + 1;
				this.#index = temp;
			}
		}
	}

	find (channelId) {
		let index = 0;
		for (let i = 0; i < this.data.length; i++) {
			index++;
			for (let j = 0; j < this.data[i].channels.length; j++) {
				if (this.data[i].channels[j].id === channelId) {
					this.#index = index;
					this.setPosition(i, j);
					return true;
				}
				else {
					index++;
				}
			}
		}
		return false;
	}

	scrollChannels (nextFlag) {
		return nextFlag ? this.#nextChannel() : this.#prevChannel();
	}

	scrollServers (nextFlag) {
		return nextFlag ? this.#nextServer() : this.#prevServer();
	}

	#nextChannel () {
		if (this.struct.numChannels() > 0) {
			if (this.#position.channel + 1 < this.data[this.#position.server].channels.length) {
				this.#index++;
				this.#position.channel++;
				return true;
			}
			else {
				let temp = 1;
				for (let i = this.#position.server + 1; i < this.data.length; i++) {
					temp++;
					if (this.data[i].channels.length > 0) {
						this.#index += temp;
						this.setPosition(i, 0);
						return true;
					}
				}
				return this.#firstChannel();
			}
		}
		else {
			return false;
		}
	}

	#prevChannel () {
		if (this.struct.numChannels() > 0) {
			if (this.#position.channel > 0) {
				this.#index--;
				this.#position.channel--;
				return true;
			}
			else {
				let temp = 1;
				for (let i = this.#position.server - 1; i >= 0; i--) {
					temp++;
					if (this.data[i].channels.length > 0) {
						this.#index -= temp;
						this.setPosition(i, this.data[i].channels.length - 1);
						return true;
					}
				}
				return this.#lastChannel();
			}
		}
		else {
			return false;
		}
	}

	#nextServer () {
		if (this.struct.numChannels() > 0) {
			let temp = this.data[this.#position.server].channels.length - this.#position.channel + 1;
			for (let i = this.#position.server + 1; i < this.data.length; i++) {
				if (this.data[i].channels.length > 0) {
					this.setPosition(i, 0);
					this.#index += temp;
					return true;
				}
				else {
					temp++;
				}
			}
			return this.#firstChannel();
		}
		else {
			return false;
		}
	}

	// actually takes you to the 1st channel in server if not already at 1st
	#prevServer () {
		if (this.struct.numChannels() > 0) {
			if (this.#position.channel > 0) {
				this.#index -= this.#position.channel;
				this.#position.channel = 0;
				return true;
			}
			else {
				let temp = 1;
				for (let i = this.#position.server - 1; i >= 0; i--) {
					if (this.data[i].channels.length > 0) {
						this.#index -= temp + this.data[i].channels.length;
						this.setPosition(i, 0);
						return true;
					}
					else {
						temp++;
					}
				}
				temp = 1;
				for (let i = this.data.length - 1; i >= 0; i--) {
					if (this.data[i].channels.length > 0) {
						for (let j = 0; j < i; j++) {
							temp += this.data[j].channels.length + 1;
						}
						this.#index = temp;
						this.setPosition(i, 0);
						return true;
					}
				}
				return false;
			}
		}
		else {
			return false;
		}
	}

	#firstChannel () {
		let temp = 1;
		for (let i = 0; this.data.length; i++) {
			if (this.data[i].channels.length > 0) {
				this.#index = temp;
				this.setPosition(i, 0);
				return true;
			}
			else {
				temp++;
			}
		}
		return false;
	}

	#lastChannel () {
		let temp = 0;
		for (let i = this.data.length - 1; i >= 0; i--) {
			if (this.data[i].channels.length > 0) {
				for (let j = 0; j < i; j++) {
					temp += this.data[j].channels.length + 1;
				}
				this.#index = temp + this.data[i].channels.length;
				this.setPosition(i, this.data[i].channels.length - 1);
				return true;
			}
		}
		return false;
	}
}

module.exports = ChannelNavigator;
