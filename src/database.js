class SingletonDatabase {
	constructor () {
		if (SingletonDatabase.exists) {
		}
		else {
			const Datastore = require('nedb');
			SingletonDatabase.exists = true;
			SingletonDatabase.instance = new Datastore({ filename: './data.db', autoload: true });
			return SingletonDatabase.instance;
		}
	}
}

function init (db) {
	return new Promise((resolve, reject) => {
		const openpgp = require('openpgp');
		db.findOne({ privateKey: { $exists: true }, publicKey: { $exists: true }, revocationCert: {$exists: true}}, (err, docs) => {
			if (err) {
				reject(err);
			}
			else if (docs == null) {
				console.log("No existing keys found. Generating new keys.");
				const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
				rl.question("Enter a name to associate with your keys: ", (name) => {
					openpgp.generateKey({ userIds: [{ name: name }], curve: 'curve25519' })
					.then((key) => {
						db.insert({
							privateKey: `${key.privateKeyArmored}`,
							publicKey: `${key.publicKeyArmored}`,
							revocationCert: `${key.revocationCertificate}`
						});
						console.log(`generated new keys associated with name:${name}`);
						warn();
						resolve(db);
					})
					.catch(reject);
				});
			}
			else {
				openpgp.key.readArmored(docs.privateKey)
				.then(({ keys: [privateKey]}) => {
					console.log(`Found keys associated with name: ${privateKey.getUserIds()}.`);
					warn();
					resolve(db);
				})
				.catch(reject);
			}
		});
	});
}

function warn () {
	console.log("DO NOT SHARE YOUR PRIVATE KEY WITH ANYONE.\nDO NOT SHARE YOUR REVOCATION CERTIFICATE WITH ANYONE");
}

module.exports = {
	Init: () => {
		return init(new SingletonDatabase())
	},
	Instance: () => {
		return new SingletonDatabase();
	},
}
