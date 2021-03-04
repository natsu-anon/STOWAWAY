const Model = require('./model.js');

class Handshake {
	constructor (date, author) {
		this.date = date;
		this.author = author;
	}

	get text () {
		return `{green-bg}{black-fg}>${this.author.tag} initiated the handshake protocol at ${this.date.toLocaleDateString()} ${this.date.toLocaleTimeString()}{/}`;
	}
}

class Message {
	constructor (date, author, content, id) {
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


class SingleChannel extends Model {
	constructor () {
		super();
		this.ts0 = null;
		this.ts1 = null;
		this.content = {};
		this.message = (ts, date, author, content, id) => {
			// console.log(`receive(): ${author}`);
			if (this.content[ts] === undefined) {
				const res = new Message(date, author, content);
				this.content[ts] = res;
				this.emit('update', res.text);
			}
		};
		this.decryptionFailure = (ts, date, author) => {
			if (this.content[ts] === undefined) {
				const res = new DecryptionFailure(date, author);
				this.content[ts] = res;
				this.emit('update', res.text);
			}
		}
		this.handshake = (ts, date, author) => {
			if (this.content[ts] === undefined) {
				const res = new Handshake(date, author);
				this.content[ts] = res;
				this.emit('update', res.text);
			}
		}
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

	/*
	receive (ts, date, author, youFlag, content) {
		const message = new Message(date, author, youFlag, content);
		this.messages[ts] = new Message(date, author, youFlag, content);
		this.emit('update', message.text());
	}
	*/

	get text () {
		const ts = Object.keys(this.content).sort((ts0, ts1) => ts0 - ts1);
		const res = [];
		for (let i = 0; i < ts.length; i++) {
			res.push(this.content[ts[i]].text);
		}
		return res.join('\n');
	}
}

module.exports = SingleChannel;
