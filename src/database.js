const Datastore = require('nedb');

function init (dbFilename) {
	return new Promise((resolve, reject) => {
		const db = new Datastore({ filename: dbFilename, autoload: true });
		db.persistence.setAutocompactionInterval(5000);
		resolve(db);
	});
}

module.exports = init;
