const loki = require('lokijs');

function init (dbFilename, autosave=true) {
	return new Promise((resolve, reject) => {
		const db = new loki(dbFilename, {
			autosave,
			serializationMethod: 'pretty',
		});
		db.loadDatabase({}, err => {
			if (err != null) {
				reject(err);
			}
			else {
				let channels = db.getCollection('channels');
				if (channels == null) {
					channels = db.addCollection('channels');
				}
				let peers = db.getCollection('peers');
				if (peers == null) {
					peers = db.addCollection('peers');
				}
				peers.addDynamicView('all_peers')
				.applyFind({ user_id: { $exists: true }, public_key: { $exists: true } });
				let revocations = db.getCollection('revocations');
				if (revocations == null) {
					revocations = db.addCollection('revocations');
				}
				// feels a little stoopid to NOT return all the collections here
				// but it also feekls stoopid to do the same
				resolve({ db, channels, peers, revocations });
			}
		});
	});
}

module.exports = init;
