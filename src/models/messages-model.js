const Model = require('./model.js');

class Handshake {
	constructor (date, author) {
		this.date = date;
		this.author = author;
	}

	get text () {
		return `\t{green-bg}{black-fg}${this.author.tag} handshake at ${this.date.toLocaleDateString()} ${this.date.toLocaleTimeString()}{/}`;
	}
}

class Message {
	constructor (date, author, content) {
		this.date = date;
		this.author = author;
		this.content = content;
	}

	get text () {
		return `{blue-fg}[${this.date.toLocaleDateString()} ${this.date.toLocaleTimeString()}] <{/}${this.author.username}{blue-fg}>{/} ${this.content}{/}`;
	}
}

class DecryptionFailure {
	constructor (date, author) {
		this.date = date;
		this.author = author;
	}

	get text () {
		return `{red-fg}[${this.date.toLocaleDateString()} ${this.date.toLocaleTimeString()}] <{underline}${this.author.username}{/underline}> Failed to decrypt message from {underline}${this.author.tag}{/}`;
	}
}


class MessagesModel extends Model {
	#content;

	constructor () {
		super();
		this.#content = [];
	}

	listen (channelId) {
		this.#content = [];
		this.message = (ts, date, author, content) => {
			// console.log(`receive(): ${author}`);
			if (this.content[ts] === undefined) {
				this.#content.push({
					timestamp: ts,
					item:  new Message(date, author, content)
				});
				this.emit('update', res.text);
			}
		};
		this.decryptionFailure = (ts, date, author) => {
			if (this.content[ts] === undefined) {
				const res = new DecryptionFailure(date, author);
				this.content[ts] = res;
				this.emit('update', res.text);
			}
		};
		this.handshake = (ts, date, author) => {
			if (this.content[ts] === undefined) {
				const res = new Handshake(date, author);
				this.content[ts] = res;
				this.emit('update', res.text);
			}
		};
	}

	timestamp (ts, id) {
		if (this.ts0 == null || ts < this.ts0) {
			this.ts0 = ts;
			this._oldest = id;
		}
		if (this.ts1 == null || ts > this.ts1) {
			this.ts1 = ts;
			this._newest = id;
		}
	}

	get oldest () {
		return this._oldest;
	}

	get newest () {
		return this._newest;
	}

	get text () {
		const ts = Object.keys(this.content).sort((ts0, ts1) => ts0 - ts1);
		const res = [];
		for (let i = 0; i < ts.length; i++) {
			res.push(this.content[ts[i]].text);
		}
		return res.join('\n');
	}
}

module.exports = MessagesModel;
