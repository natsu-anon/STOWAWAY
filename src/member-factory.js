const Mediator = require('./mediators/mediator.js');

async function displayMember (member, stowaway) {
	if ((await stowaway.signedKey(member.user.id))) {
		return `{green-fg}${member.displayName} (${member.user.tag}){/green-fg}`;
	}
	else {
		return `{${member.displayName} (${member.user.tag}){/green-fg}`;
	}
}

class Members extends Mediator {
	constructor (members, stowaway, channel) {
		super();
		this.data = members;
		this.#sort();
		this.index = members.length > 0 ? 0 : null;
		this.stowaway = stowaway;
		this.channel = channel;
		stowaway.on('handshake', (accepted, message) => {
			if (accepted && message.author.id !== stowaway.id && message.channel.id === channel.id && !this.data.includes(message.member)) {
				this.data.push(message.author);
				if (this.index == null) {
					this.index = 0;
				}
				this.#sort();
				this.representation().then(text => { this.emit('update', text); });
			}
		});
		stowaway.client.on('guildMemberRemove', member => {
			const index = this.data.indexOf(member);
			if (member.guild.id === channel.guild.id && index > -1) {
				this.data.splice(index, 1);
				if (this.data.length <= 0) {
					this.index = null;
				}
				else {
					this.index = this.index % this.data.length;
				}
				this.representation().then(text => { this.emit('update', text); });
			}
		});
		stowaway.client.on('guildMemberUpdate', (member0, member1) => {
			const index = this.data.indexOf(member0);
			if (member0.guild.id === channel.guild.id && index > -1) {
				this.data[index] = member1;
			}
			this.representation().then(text => { this.emit('update', text); });
		});
	}

	get percentage () {
		return this.index != null ? this.index / this.members.length : 0;
	}

	get numMembers () {
		return this.data.length;
	}

	scrollMembers (nextFlag) {
		if (this.index != null) {
			nextFlag ? this.#nextMember() : this.#prevMember();
			this.representation().then(text => { this.emit('update', text); });
		}
	}

	#nextMember () {
		this.index = (this.index + 1) % this.members.length;
		return true;
	}

	#prevMember () {
		this.index--;
		if (this.index < -1) {
			this.index = this.members.length - 1;
		}
	}

	async signMember () {
		if (this.index != null && !(await this.stowaway.signedUser(this.data[this.index]).user.id)) {
			const userId = this.data[this.index].user.id;
			if (!(await this.stowaway.signedKey(userId))) {
				this.stowaway.signKey(this.channel, userId);
			}
		}
	}

	async representation () {
		if (this.data.length > 0) {
			const res = [];
			for (let i = 0; i < this.data.length; i++) {
				if (i === this.index) {
					res.push(`{inverse}>{/inverse} ${await displayMember(this.data[i], this.stowaway)}`);
				}
				else {
					res.push(await displayMember(this.data[i], this.stowaway));
				}
			}
			return res.join('\n');
		}
		else {
			return 'only you';
		}
	}

	#sort () {
		this.data.sort((a, b) => (a.id < b.id ? -1 : 1));
	}
}

class MembersFactory {

	constructor (stowaway, db) {
		this.stowaway = stowaway;
		this.db = db;
	}

	mediator (channel) {
		return new Promise((resolve, reject) => {
			this.db.find({ user_id: { $exists: true } }, (err, docs) => {
				if (err != null) {
					reject(err);
				}
				else {
					const data = [];
					const userIds = docs.map(x => x.user_id);
					channel.members.filter(x => userIds.includes(x.user.id))
					.each(member => {
						if (member.user.id !== this.stowaway.id) {
							data.push(member);
						}
					});
					resolve(new Members(data, this.stowaway, channel));
				}
			});
		});
	}

}

module.exports = MembersFactory;
