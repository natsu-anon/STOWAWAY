const loki = require('lokijs');

function addCollections (db) {
	let channels = db.getCollection('channels');
	if (channels == null) {
		channels = db.addCollection('channels');
	}
	let peers = db.getCollection('peers');
	if (peers == null) {
		peers = db.addCollection('peers');
	}
	let revocations = db.getCollection('revocations');
	if (revocations == null) {
		revocations = db.addCollection('revocations');
	}
	return { db, channels, peers, revocations };
}

function init (dbFilename, autosave=true) {
	return new Promise((resolve, reject) => {
		const db = new loki(dbFilename, {
			autosave,
		});
		db.loadDatabase({}, err => {
			if (err != null) {
				reject(err);
			}
			else {
				resolve(addCollections(db));
			}
		});
	});
}

module.exports = init;
