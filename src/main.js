const fs = require('fs');
const openpgp = require('openpgp');
const blessed = require('blessed');

console.log(fs.readFileSync('./banner.txt', 'utf8'));
console.log("(C) 2021 WTFPL - Do What the Fuck You Want to Public License\n");

function prepClient (client) {
	// set up client event listeners here
	return client;
}

require('./database.js').Init(openpgp)
	.then((db) => { return require('./client.js').Login(fs, db, prepClient); })
	.then(({database: db, client: cli}) =>  {
		// continue on with application now that you have ready database, logged in prepped client, and openpgp.
		console.log(`logged in as: ${cli.user.username}`);
		console.log("LAUNCH BLESSED");
		main(db, cli);
	})
	.catch((err) => { console.error(err); });


function main (db, cli) {
	// TODO
}
