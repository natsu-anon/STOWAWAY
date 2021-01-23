const fs = require('fs');
const process = require('process');
const openpgp = require('openpgp');
const blessed = require('blessed');

console.log(fs.readFileSync('./banner.txt', 'utf8'));
console.log("Licensed via WTFPL\n");

function prepClient (client) {
	// set up client event listeners here
	return client;
}

require('./database.js').Init(openpgp)
	.then((db) => {
		return new Promise((resolve, reject) => {
			require('./client.js').Login(fs, prepClient)
			.then((cli) => {
				resolve({
					database: db,
					client: cli
				});
			})
			.catch(reject);
		});
	})
	.then(({database: db, client: cli}) =>  {
		console.log(`logged in as: ${cli.user.username}`);
		console.log("LAUNCH BLESSED");
	})
	.catch((err) => { console.error(err); });


function main (db, cli) {
	// TODO
}
