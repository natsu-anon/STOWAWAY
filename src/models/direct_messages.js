const Model = require('./model.js');

class DirectMessage {
	constructor (id, tag) {
		this.id = id;
		this.tag = tag;
	}
}

class DirectMessages extends Model {
	constructor (client, db) {
		this.channels = [];
		dbCache(client, db);
		client.on('userUpdate', (u0, u1) => {
			if (userUpdate(u0, u1)) {
				this.emit('update');
			}
		});
		this.focus = null;
	}

	dbCache (client, db) {
		db.find({ public_key: { $exists: true } }, (err, docs) => {
			docs.forEach(doc => {
				client.users.fetch(doc.user_id)
				.then(user => {
					this.channels.push(new DirectMessage(user.id, user.tag));
				});
			});
		});
	}

	userUpdate (user0, user1) {
		for (let i = 0; i < this.channels.length; i++) {
			if (this.channels[i].id == user0.id) {
				this.channels[i].id == user1.id;
				this.channels[i].tag == user1.tag;
				return true;
			}
		}
		return false;

	}

	focusNext () {
		focusDelta(1);
	}

	focusPrev () {
		focusDelta(-1);
	}

	focusDelta (delta) {
		if (this.focus != null) {
			let i = this.channels.findIndex(elem => elem.id == this.focus.id) + delta;
			if (i > this.channels.length) {
				i = i % this.channels.length;
			}
			else if (i < 0) {
				i = this.channels.length - i;
			}
			this.focus = this.channels[i];
			this.emit('update');
		}
		else if (this.channels.length > 0) {
			this.focus = this.channels[0];
			this.emit('update');
		}
	}

	userCache (user) {
		for (let i = 0; i < this.channels.length; i++) {
			if (this.channels[i].id == user.id) {
				return;
			}
		}
		this.channels.push(new DirectMessage(user.id, user.tag));
		this.emit('update');
	}

	display () {
		if (this.channels.length > 0) {
			let res = [];
			let temp;
			for (let i = 0; i < this.channels.length; i++) {
				if (this.focus == this.channels[i].id) {
					res.push(`{underline}${this.channels[i].tag}{/underline}`);
				}
				else {
					res.push(this.channels[i].tag);
				}
			}
			return res.join('\n');
		}
		else {
			return 'no direct messages';
		}
	}

}
