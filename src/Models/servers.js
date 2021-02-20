const Model = require('./model.js');
const { Node, ParentNode, RootNode } = require('../Structs/tree.js');

class Server extends RootNode {
	constructor (id, name) {
		super(id);
		this.name = name;
		this.expand = true;
	}
}

class Category extends ParentNode {
	constructor (id, name) {
		super(id);
		this.name = name;
		this.expand = true;
	}
}

class Channel extends Node {
	constructor (id, name, topic) {
		super(id);
		this.name = name;
		this.topic = topic;
	}
}

class Servers extends Model {
	constructor (client) {
		this.servers = [];
		client.guilds.cache.each(guild => cacheGuild(guidl));
		client.on('guildCreate', (g) => {
			cacheGuild(g);
			this.emit('update');
		});
		client.on('guildUpdate', (g0, g1) => {
			updateGuild(g0, g1);
			this.emit('update');
		});
		client.on('guildDeleted', (g) => {
			clearGuild(g);
			this.emit('update');
		});
		client.on('channelCreate', (ch) => {
			if (cacheChannel(ch)) {
				this.emit('update');
			}
		});
		client.on('channelDelete', (ch) => {
			if (clearChanne(ch)) {
				this.emit('update');
			}
		});
		client.on('channelUpdate', (ch) => {
			if (updateChannel(ch)) {
				this.emit('update');
			}
		});
		this.focus = null;
		if (this.servers.length > 0) {
			this.focus = this.servers[0].id;
		}
	}

	cacheGuild (guild) {
		let current = new Server(guild.id, guild.name);
		this.servers.AddChild(current);
		let temp = {};
		let node;
		guild.channels.cache(channel => channel.isText())
		.each((channel) => {
			node = new Channel(channel.id, channel.name, channel.topic);
			if (channel.parent == null) {
				current.addChild(node);
			}
			else {
				if (channel.parentID in temp) {
					temp[channel.parentID].push(node);
				}
				else {
					temp[channel.parentID] = [ node ];
				}
			}
		});
		let category;
		for (let id in temp) {
			category = guild.channels.cache.find(channel => channel.id == id);
			node = new Category(category.id, category.name);
			this.current.addChild(node);
			for (let i = 0; i < temp[id].length; i++) {
				node.addChild(temp[id][i]);
			}
			current.addChild(node);
		}
	}

	clearGuild (guild) {
		for (let i = 0; i < this.servers.length; i++) {
			if (this.servers[i].id == guild.id) {
				this.servers.splice(i);
				return;
			}
		}
	}

	updateGuild (guild0, guild1) {
		for (let i = 0; i < this.servers.length; i++) {
			if (this.servers[i].id == guild0.id) {
				this.servers[i].id == guild1.id;
				this.servers[i].name == guild1.name;
				return;
			}
		}
	}

	channelCreate (channel) {
		if (!channel.isText || channel.guild == null) {
			return false;
		}
		else {
			const ch = new Channel(channel.id, channel.name);
			const server = this.servers.find(s => s.id == channel.guild.id);
			if (channel.parentID == null) {
				server.addChild(ch);
			}
			else {
				let category = server.find(channel.parentID);
				if (category == null) {
					category = new Category(channel.parentID, channel.parent.name);
					server.addChild(category);
				}
				category.addChild(ch);
			}
			return true;
		}
	}

	channelDelete (channel) {
		if (channel.guild == null) {
			return false;
		}
		else {
			const server = this.server.find(s => s.id == channel.guild.id);
			return server.remove(ch.id);
		}
	}

	channelUpdate (channel0, channel1) {
		if (channel0.guild) {
			return false;
		}
		else {
			const server = this.server.find(s => s.id == channel.guild.id);
			const ch = server.find(channel0.id);
			if (ch != null) {
				ch.id = channel1.id;
				ch.name = channel1.name;
				if (channel0.isText) {
					ch.topic = channel1.topic;
				}
				if (channel0.parentID == channel1.parentID) {
					return true;
				}
				else {
					const flag0 = ch0.parentID != null;
					const flag1 = ch1.parentID != null;
					let category;
					if  (flag0) {
						category = server.find(channel0.parentID);
						if (category.children.length > 1) {
							category.remove(ch.id);
						}
						else {
							server.remove(channel0.parentID);
						}
					}
					if (flag1) {
						category = server.find(channel1.parentID);
						if (category == null) {
							category = new Category(channel1.parentID, channel1.parent.name);
							server.addChild(category);
						}
						category.addChild(ch);
					}
					return true;
				}
			}
			else {
				return false;
			}
		}
	}

	display () {
		if (this.servers.length > 0) {
			let res = [];
			for (let i = 0; i < this.servers.length; i++) {
				res.concat(displayExpanded(this.servers[i]));
			}
			return res.join('\n');
		}
		else {
			return 'no servers');
		}
	}

	displayExpanded (node, depth=0) {
		let temp = node.name;
		if (node.expand != undefined) {
			temp  = (node.expand ? "[-] " : "[+] ") + temp;
		}
		temp = temp.padStart(temp.length + 2 * depth, ' ');
		if (node.id == this.focus) {
			temp = `{underline}${temp}{/}`;
		}
		if (node.expand != undefined && node.expand == true) {
			let res = [ temp ];
			for (let i = 0; i < node.children.length; i++) {
				res.concat(displayExpanded(node.children[i], depth + 1));
			}
			return res
		}
		else {
			return [ temp ];
		}
	}
}

module.exports = Servers;
