// const Datastore = require('nedb');
const loki = require('lokijs');

function init (dbFilename) {
	let db;
	return new Promise(resolve => {
		db = new loki(dbFilename, {
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
				let revocations = db.getCollection('revocations');
				if (revocations == null) {
					revocations = db.addCollection('revocations');
				}
				// feels a little stoopid to NOT return all the collections here
				// but it also feekls stoopid to do the same
				resolve({ db, channels, peers, revocations });
			},
			autosave: true,
		});
	});
}

module.exports = init;
