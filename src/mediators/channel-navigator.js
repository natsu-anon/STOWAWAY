class ChannelNavigator {

	constructor (struct, initIndex) {
		this.struct = struct;
		this._index = initIndex(this);
	}

	get index () {
		return this._index;
	}

	get percentage () {
		if (this.struct.data.length === 0) {
			return 0;
		}
		else {
			return this._index / (this.struct.data.length + this.struct.numChannels()) * 100;
		}
	}

	set index (value) {
		this._index = value;
	}

	get data () {
		return this.struct.data;
	}

	get channel () {
		if (this._index != null) {
			return this.data[this._position.server].channels[this._position.channel];
		}
		else {
			return null;
		}
	}

	setPosition (server, channel) {
		this._position = { server, channel };
	}

	checkIndex () {
		if (this._position === undefined) {
			this._firstChannel();
		}
		else {
			const index = this._position.server;
			if (index >= this.data.length) {
				this._lastChannel();
			}
			else if (this._position.channel >= this.data[index].channels.length) {
				if (this.data[index].channels.length > 0) {
					this._index += (this.data[index].channels.length - 1) - this._position.channel;
					this._position.channel = this.data[index].channels.length - 1;
				}
				else {
					this._firstChannel(); // KEEP IT SIMPLE
				}
			}
			else {
				let temp = 0;
				for (let i = 0; i < this._position.server; i++) {
					temp += this.data[i].channels.length + 1;
				}
				temp += this._position.channel + 1;
				this._index = temp;
			}
		}
	}

	find (channelId) {
		let index = 0;
		for (let i = 0; i < this.data.length; i++) {
			index++;
			for (let j = 0; j < this.data[i].channels.length; j++) {
				if (this.data[i].channels[j].id === channelId) {
					this._index = index;
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
		return nextFlag ? this._nextChannel() : this._prevChannel();
	}

	scrollServers (nextFlag) {
		return nextFlag ? this._nextServer() : this._prevServer();
	}

	_nextChannel () {
		if (this.struct.numChannels() > 0) {
			if (this._index == null) {
				return this._firstChannel();
			}
			else if (this._position.channel + 1 < this.data[this._position.server].channels.length) {
				this._index++;
				this._position.channel++;
				return true;
			}
			else {
				let temp = 1;
				for (let i = this._position.server + 1; i < this.data.length; i++) {
					temp++;
					if (this.data[i].channels.length > 0) {
						this._index += temp;
						this.setPosition(i, 0);
						return true;
					}
				}
				return this._firstChannel();
			}
		}
		else {
			return false;
		}
	}

	_prevChannel () {
		if (this.struct.numChannels() > 0) {
			if (this._index == null) {
				return this._firstChannel();
			}
			else if (this._position.channel > 0) {
				this._index--;
				this._position.channel--;
				return true;
			}
			else {
				let temp = 1;
				for (let i = this._position.server - 1; i >= 0; i--) {
					temp++;
					if (this.data[i].channels.length > 0) {
						this._index -= temp;
						this.setPosition(i, this.data[i].channels.length - 1);
						return true;
					}
				}
				return this._lastChannel();
			}
		}
		else {
			return false;
		}
	}

	_nextServer () {
		if (this.struct.numChannels() > 0) {
			if (this._index == null) {
				return this._firstChannel();
			}
			else {
				let temp = this.data[this._position.server].channels.length - this._position.channel + 1;
				for (let i = this._position.server + 1; i < this.data.length; i++) {
					if (this.data[i].channels.length > 0) {
						this.setPosition(i, 0);
						this._index += temp;
						return true;
					}
					else {
						temp++;
					}
				}
				return this._firstChannel();
			}
		}
		else {
			return false;
		}
	}

	// actually takes you to the 1st channel in server if not already at 1st
	_prevServer () {
		if (this.struct.numChannels() > 0) {
			if (this._index == null) {
				return this._firstChannel();
			}
			else if (this._position.channel > 0) {
				this._index -= this._position.channel;
				this._position.channel = 0;
				return true;
			}
			else {
				let temp = 1;
				for (let i = this._position.server - 1; i >= 0; i--) {
					if (this.data[i].channels.length > 0) {
						this._index -= temp + this.data[i].channels.length;
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
						this._index = temp;
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

	_firstChannel () {
		let temp = 1;
		for (let i = 0; this.data.length; i++) {
			if (this.data[i].channels.length > 0) {
				this._index = temp;
				this.setPosition(i, 0);
				return true;
			}
			else {
				temp++;
			}
		}
		return false;
	}

	_lastChannel () {
		let temp = 0;
		for (let i = this.data.length - 1; i >= 0; i--) {
			if (this.data[i].channels.length > 0) {
				for (let j = 0; j < i; j++) {
					temp += this.data[j].channels.length + 1;
				}
				this._index = temp + this.data[i].channels.length;
				this.setPosition(i, this.data[i].channels.length - 1);
				return true;
			}
		}
		return false;
	}
}

module.exports = ChannelNavigator;
