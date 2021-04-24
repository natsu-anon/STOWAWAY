const Mediator = require('./mediators/mediator.js');

async function displayMember (member, stowaway) {
	const flag = await stowaway.signedKey(member.id);
	const temp = `${member.displayName} (${member.user.tag})`;
	return {
		signed: flag,
		text: flag ? `{green-fg}${temp}{/green-fg}` : temp
	};
}

class Members extends Mediator {
	constructor (data, stowaway, channel) {
		super();
		this.data = data;
		this._sort();
		this.index = data.length > 0 ? 0 : null;
		this.id = stowaway.id;
		this.stowaway = stowaway;
		this.channel = channel;
		this.channelId = channel.id;
		this.guildID = channel.guild.id;
		const memberRemove = member => { this.memberRemove(member); };
		const memberUpdate = (member0, member1) => { this.memberUpdate(member0, member1); };
		const handshake = (message, accepted) => { this.handshake(message, accepted); };
		const update = message => { this.update(message); };
		stowaway.client.on('guildMemberRemove', memberRemove);
		stowaway.client.on('guildMemberUpdate', memberUpdate);
		stowaway.on('handshake', handshake);
		stowaway.on('key update', update);
		stowaway.on('revocation', update);
		this.unsubscribe = () => {
			stowaway.client.removeListener('guildMemberRemove', memberRemove);
			stowaway.client.removeListener('guildMemberUpdate', memberUpdate);
			stowaway.removeListener('handshake', handshake);
			stowaway.removeListener('key update', update);
			stowaway.removeListener('revocation', update);
		};
	}

	get percentage () {
		return this.index != null ? this.index / this.data.length : 0;
	}

	get numMembers () {
		return this.data.length;
	}

	scrollMembers (nextFlag) {
		if (this.index != null) {
			nextFlag ? this._nextMember() : this._prevMember();
			this.representation().then(text => { this.emit('update', text); });
		}
	}

	_nextMember () {
		this.index = (this.index + 1) % this.data.length;
		return true;
	}

	_prevMember () {
		this.index--;
		if (this.index < -1) {
			this.index = this.data.length - 1;
		}
	}

	handshake (message, accepted) {
		if (accepted && message.author.id !== this.id && message.channel.id === this.channelId) {
			try {
				if (this.data === undefined) {
					throw Error(`FUG\n${Object.keys(this)}`);
				}
				if (this.data.findIndex(({ id }) => message.member.id === id) === -1) {
					this.data.push(message.member);
					if (this.index == null) {
						this.index = 0;
					}
					this._sort();
				}
				this.representation().then(text => { this.emit('update', text); });
			}
			catch (err) {
				if (err != null) {
					throw Error(`Error in Members.handshake(), ${err.stack}`);
				}
				else {
					throw Error(`Unexpected Error!
					authorId: ${message.author.id},
					selfId: ${this.id},
					channelId: ${this.channelId}`);
				}
			}
		}
	}

	memberRemove (member) {
		const index = this.data.indexOf(member);
		if (member.guild.id === this.guildId && index > -1) {
			this.data.splice(index, 1);
			if (this.data.length <= 0) {
				this.index = null;
			}
			else {
				this.index = this.index % this.data.length;
			}
			this.representation().then(text => { this.emit('update', text); });
		}
	}

	memberUpdate (member0, member1) {
		const index = this.data.indexOf(member0);
		if (member0.guild.id === this.guildId && index > -1) {
			this.data[index] = member1;
			this.representation().then(text => { this.emit('update', text); });
		}
	}

	update (message) {
		if (message.author.id === this.id && message.channel.id === this.channelId) {
			this.representation().then(text => { this.emit('update', text); });
		}
	}

	async signMember () {
		if (this.index != null && !(await this.stowaway.signedKey(this.data[this.index].id))) {
			await this.stowaway.signKey(this.channel, this.data[this.index].id);
		}
	}

	async representation () {
		if (this.data.length > 0) {
			const res = [];
			let temp;
			for (let i = 0; i < this.data.length; i++) {
				temp = await displayMember(this.data[i], this.stowaway);
				if (i === this.index) {
					if (temp.signed) {
						res.push(`{green-bg}{black-fg}X{/} ${temp.text}`);
					}
					else {
						res.push(`{inverse}>{/inverse} ${temp.text}`);
					}
				}
				else {
					res.push(temp.text);
				}
			}
			return res.join('\n');
		}
		else {
			return 'only you';
		}
	}

	_sort () {
		this.data.sort((a, b) => (a.id < b.id ? -1 : 1));
	}
}

class MembersFactory {

	constructor (stowaway, db) {
		this.stowaway = stowaway;
		this.db = db;
		this.current = null;
	}

	mediator (channel) {
		if (this.current != null) {
			this.current.unsubscribe();
		}
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
					this.current = new Members(data, this.stowaway, channel);
					resolve(this.current);
				}
			});
		});
	}

}

module.exports = MembersFactory;
