const Model = require('./model.js');

function memberData (member) {
	const res = {
		id: member.user.id,
		tag: member.user.tag
	};
	if (member.nickname != null) {
		res.nickname = member.nickname;
	}
	return res;
}

class MemberModel extends Model {

	constructor () {
		super();
		this.data = [];
	}

	initialize (channel, key, db) {
		this.data = [];
		this.emit('update');
		return new Promise((resolve, reject) => {
			this.db.find({ user_id: { $exists: true } }, (err, docs) => {
				if (err != null) {
					reject(err);
				}
				else {
					Promise.all(
						channel.members.filter(member => docs.map(x => x.user_id).includes(member.user.id))
						.map(member => Promise((res, rej) => {

						})
					})
					.then(() => {
						this.emit('update');
						resolve(this);
					})
					.catch(reject)
				}
			});
		});
	}
}

module.exports = MemberModel;
