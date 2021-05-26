const loki = require('lokijs');

// NOTE undicker this
function init (dbFilename, autosave=true) {
	let db;
	return new Promise(resolve => {
		db = new loki('foo.db', {
			autoload: true,
			autoloadCallback: () => {
				let channels = db.getCollection('channels');
				if (channels == null) {
					channels = db.addCollection('channels');
				}
				let peers = db.getCollection('peers');
				if (peers == null) {
					peers = db.addCollection('peers');
				}
				peers.addDynamicView('all_peers')
				.applyFind({ user_id: { $exists: true },  public_key: { $exists: true }});
				let revocations = db.getCollection('revocations');
				if (revocations == null) {
					revocations = db.addCollection('revocations');
				}
				// feels a little stoopid to NOT return all the collections here
				// but it also feekls stoopid to do the same
				resolve({ db, channels, peers, revocations });
			},
			// autosave
		});
	});
}

module.exports = init;
