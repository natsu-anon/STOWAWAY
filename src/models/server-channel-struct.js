class ServerChannel {

	// guilds & channels are objects with keys data, index, and sort
	constructor (guilds, channels) {
		this.data = [];
		this.guilds = guilds;
		this.channels = channels;
	}

	containsServer (guild) {
		return this.guilds.index(guild, this.data) >= 0;
	}

	numChannels (guild) {
		if (guild == null) {
			let res = 0;
			this.data.forEach(server => {
				res += server.channels.length;
			});
			return res;
		}
		else {
			const i = this.guilds.index(guild, this.data);
			return i >= 0 ? this.data[i].channels.length : 0;
		}
	}

	containsChannel (channel) {
		return this.channels.index(channel, this.data).j >= 0;
	}

	firstChannel () {
		for (let i = 0; i < this.data.length; i++) {
			if (this.data[i].channels.length > 0) {
				return this.data[i].channels[0];
			}
		}
	}

	findChannel (id) {
		for (let i = 0; i < this.data.length; i++) {
			for (let j = 0; j < this.data[i].channels.length; j++) {
				if (this.data[i].channels[j].id === id) {
					return this.data[i].channels[j];
				}
			}
		}
	}

	flatten () {
		const res = [];
		let temp;
		for (let i = 0; i < this.data.length; i++) {
			temp = this.data[i];
			temp.server = true;
			res.push(temp);
			for (let j = 0; j < this.data[i].channels.length; j++) {
				temp = this.data[i].channels[j];
				temp.server = false;
				res.push(temp);
			}
		}
		return res;
	}

	addServer (guild) {
		const temp = this.guilds.data(guild);
		temp.channels = [];
		this.data.push(temp);
		this.guilds.sort(this.data);
		return true;
	}

	updateServer (guild0, guild1) {
		const i = this.guilds.index(guild0, this.data);
		if (i >= 0) {
			const channels = this.data[i].channels;
			this.data[i] = this.guilds.data(guild1);
			this.data[i].channels = channels;
			return true;
		}
		else {
			return false;
		}
	}

	removeServer (guild) {
		const i = this.guilds.index(guild, this.data);
		if (i >= 0) {
			this.data.splice(i, 1);
			return true;
		}
		else {
			return false;
		}

	}

	addChannel (channel, user) {
		const i = this.guilds.index(channel.guild, this.data);
		if (i >= 0) {
			this.data[i].channels.push(this.channels.data(channel, user));
			this.channels.sort(this.data[i].channels);
		}
		else {
			const server = this.guilds.data(channel.guild);
			server.channels = [ this.channels.data(channel, user) ];
			this.data.push(server);
			this.guilds.sort(this.data);
		}
		return true;
	}

	addChannelData (guild, data) {
		const i = this.guilds.index(guild, this.data);
		if (i >= 0) {
			this.data[i].channels.push(data);
			this.channels.sort(this.data[i].channels);
		}
		else {
			const server = this.guilds.data(guild);
			server.channels.push = data;
			this.data.push(server);
			this.guilds.sort(this.data);
		}
		return true;
	}

	updateChannel (channel0, channel1) {
		const { i, j } = this.channels.index(channel0, this.data);
		if (i >= 0 && j >= 0) {
			this.data[i].channels[j] = this.channels.data(channel1);
			return true;
		}
		else {
			return false;
		}
	}

	removeChannel (channel) {
		const { i, j } = this.channels.index(channel, this.data);
		if (i >= 0 && j >= 0) {
			this.data[i].channels.splice(j, 1);
			if (this.data[i].channels.length === 0) {
				this.data.splice(i, 1);
			}
			return true;
		}
		else {
			return false;
		}
	}

	withChannel (id, func) {
		for (let i = 0; i < this.data.length; i++) {
			for (let j = 0; j < this.data[i].channels.length; j++) {
				if (this.data[i].channels[j].id === id) {
					this.data[i].channels[j] = func(this.data[i].channels[j]);
					return true;
				}
			}
		}
		return false;
	}
}

module.exports = ServerChannel;
