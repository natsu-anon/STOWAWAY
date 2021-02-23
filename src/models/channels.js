const Model = require('./model.js');

class Message {
	constructor (timestamp, author, youFlag, content) {
		this.timestamp = timestamp;
		this.author = author;
		this.youFlag = youFlag;
		this.content = content;
	}

	display () {
		if (youFlag) {
			return `[${timestamp}] <${author}(YOU)> ${content}`;
		}
		else {
			return `[${timestamp}] <${author}> ${content}`;
		}
	}
}

class Channel extends Model {
	constructor (client, channel, stowaway) {
		this.id = channel.id;
		this.name = channel.name;
		this.messages = [];
		const handleMessage = (message) => {
			const res = stowaway.receieve(message);
			if (res.cache) {
				this.messages.push(new Message(res.timestamp, res.author, res.youFlag, res.content));
			}
		};
		channel.messages.fetch({ cache: false }).each(handleMessage);
		client.on('message', (message) => {
			handleMessage(message);
			this.emit('update');
		});
		client.on('channelUpdate', (ch0, ch1) => {
			if (ch0.id == channel.id) {
				update(ch1)
				this.emit('update');
			}
		});
	}

	update (channel) {
		this.id = channel.id;
		this.name = channel.name;
	}

	display () {
		return {
			header: this.name,
			body: this.messages.map(m => m.display()).join('\n'),
		};
	}
}

class GuildChannel extends Channel {
	constructor (client, channel, stowaway, guild) {
		super(client, channel, stowaway);
		this.guildID = guild.id;
		this.guildName = guild.name;
		this.topic = channel.topic;
		client.on('guildUpdate', (g0, g1) => {
			if (g0.id == this.guildID) {
				guildUpdate(g1);
				this.emit('update');
			}
		});
	}

	update (channel) {
		super.update(channel);
		this.topic = channel.topic;
	}

	guildUpdate (guild) {
		this.guildID = guild.id;
		this.guildName = guild.name;
	}

	display () {
		return {
			header: `{bold}${this.guildName} #${this.name}{/bold} ${this.topic}`,
			body: this.messages.map(m => m.display()).join('\n'),
		}
	}
}

class Channels extends Model {
	cosntructor (client, db, stowaway) {
		this.channels = [];
		client.guilds.cache.each(guild => guildCache(client, guild));
		dbCache(client, db);
		client.on('channelCreate', (channel) => {
			create(client, channel)
		});
		client.on('channelDelete', clear);
		this.focus = null;
	}

	create (client, channel) {
		this.channels.push(new Channel(ch.id, ch.name. ch.topic, stowaway));
	}

	clear (channel) {
		for (int i = 0; this.channels.length; i++) {
			if (this.channels[i].id == channel.id) {
				this.channels.splice(i);
				return;
			}
		}
	}

	guildCache (client, guild, stowaway) {
		guild.channels.cache(channel => channel.isText())
		.each((channel) => {
			this.channels.push(new GuildChanne(client, channel, stowaway, guild);
		});
	}

	dbCache (client, db, stowaway) {
		db.find({ public_key: { $exists: true }}, (err, docs) => {
			docs.forEach(doc => {
				client.users.fetch(doc.user_id)
				.then(user => {
					return user.createDM();
				})
				.then(channel => {
					this.channels.push(new Channel(client, channel, stowaway));
				});
			});
		});
	}

	display () {
		if (this.focus != null) {
			return this.focus.display();
		}
		else {
			return {
				header: "Welcome!",
				body: "landing message, basic controls, & begging for internet money",
			};
		}
	}

	setFocus (id) {
		const channel = this.channels.find(ch => ch.id == id);
		if (channel != null) {
			if (this.focus != null) {
				this.focus.removeAllListeners('update');
			}
			this.focus = channel;
			this.focus.on('update', () => {
				this.emit('update');
			});
			this.emit('update');
		}
	}
}

module.exports = Channels;
