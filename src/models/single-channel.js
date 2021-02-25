const Model = require('./model.js');

class Message {
	constructor (date, author, youFlag, content) {
		/*
		this.date = date;
		this.author = author;
		this.youFlag = youFlag;
		this.content = content;
		*/
		this.text = () => {
			if (youFlag) {
				return `[${date}] <${author}(YOU)> ${content}`;
			}
			else {
				return `[${date}] <${author}> ${content}`;
			}
		};
	}
}

class SingleChannel extends Model {
	constructor () {
		super();
		this.messages = {};
		this.receive = (ts, date, author, youFlag, content) => {
			// console.log(`receive(): ${author}`);
			const message = new Message(date, author, youFlag, content);
			this.messages[ts] = new Message(date, author, youFlag, content);
			this.emit('update', message.text());
		};
	}

	/*
	receive (ts, date, author, youFlag, content) {
		const message = new Message(date, author, youFlag, content);
		this.messages[ts] = new Message(date, author, youFlag, content);
		this.emit('update', message.text());
	}
	*/

	get text () {
		let ts = Object.keys(this.messages).sort((ts0, ts1) => ts0 - ts1);
		const res = [];
		for (let i = 0; i < ts.length; i++) {
			res.push(this.messages[ts[i]].text());
		}
		return res.join('\n');
	}
}

module.exports = SingleChannel;
