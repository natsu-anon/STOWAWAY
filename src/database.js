const Datastore = require('nedb');

function init (dbFilename) {
	const db = new Datastore({ filename: dbFilename, autoload: true });
	db.persistence.setAutocompactionInterval(5000);
	return db;
}

module.exports = init;
