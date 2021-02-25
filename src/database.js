const Datastore = require('nedb');

function init (dbFilename) {
	return Promise.resolve(new Datastore({ filename: dbFilename, autoload: true }));
}

module.exports = init;
