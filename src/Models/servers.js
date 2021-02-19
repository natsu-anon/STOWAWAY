const Model = require('./model.js');

class Node {
	constructor (name, id) {
		this.name = name;
		this.id = id;
	}

	find (id) {
		if (this.id == id) {
			return { success: true, value: this };
		}
		else {
			return { success: false };
		}
	}
}

class ParentNode extends Node {
	constructor (name, id) {
		super(name, id);
		this.collapsed = false;
		this.children = [];
	}

	addChild (node) {
		this.children.push(node);
	}

	find (id) {
		if (this.id == id) {
			return { success: true, value: this };
		}
		else {
			var temp;
			for (let i = 0; i < children.length; i++) {
				temp = this.children[i].find(id);
				if (temp.success) {
					return { success: true, value: this };
				}
			}
			return { success: false };
		}
	}
}

class RootNode {
	constructor () {
		this.children = []
	}

	find (id) {
		var temp;
		for (let i = 0; i < this.children.length; i++) {
			temp = this.children[i].find(id);
			if (temp.success) {
				return temp.value;
			}
		}
		return null;
	}

	addChild (node) {
		this.children.push(node);
	}
}

class Server extends ParentNode {}

class Category extends ParentNode {}

class Channel extends Node {}

class Servers extends Model {
	constructor (client) { // only pass in a ready client
		this.servers = new RootNode();
		client.guilds.cache.each(cacheGuild);
		client.on('guildCreate', cacheGuild);
		// TODO handle being removed from a server
		//client.on('guildDelete', 
	}

	cacheGuild (guild) {
		let current = new Server(guild.id, guild.name);
		this.servers.AddChild(current);
		let temp = {};
		let node;
		guild.channels.cache(channel => channel.isText())
		.each((channel) => {
			node = new Channel(channel.id, channel.name);
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

	print () {
	}
}

module.exports = Servers;
