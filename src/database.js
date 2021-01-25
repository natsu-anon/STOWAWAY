function init (openpgp) {
	const Datastore = require('nedb');
	const db = new Datastore({ filename: './data.db', autoload: true });
	return new Promise((resolve, reject) => {
		db.findOne({ privateKey: { $exists: true }, publicKey: { $exists: true }, revocationCert: {$exists: true}}, (err, docs) => {
			if (err) {
				reject(err);
			}
			else if (docs == null) {
				console.log("No existing keys found. Generating new keys.");
				const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
				rl.question("Enter a nickname to associate with your keys:\n>", (name) => {
					openpgp.generateKey({ userIds: [{ name: name }], curve: 'curve25519' })
					.then((key) => {
						db.insert({
							privateKey: `${key.privateKeyArmored}`,
							publicKey: `${key.publicKeyArmored}`,
							revocationCert: `${key.revocationCertificate}`
						});
						console.log(`generated new keys associated with nickname: ${name}`);
						warn();
						resolve({key: key, database:db});
					})
					.catch(reject);
				});
			}
			else {
				openpgp.key.readArmored(docs.privateKey)
				.then(({ keys: [key]}) => {
					console.log(`Found keys associated with nickname: ${key.getUserIds()}`);
					warn();
					resolve({key: key, database: db});
				})
				.catch(reject);
			}
		});
	});
}

function warn () {
	console.log(`\x1b[33m
#########################################################
# DO NOT SHARE YOUR data.db FILE WITH ANYONE.           #
# DO NOT SHARE YOUR PRIVATE KEY WITH ANYONE.            #
# DO NOT SHARE YOUR REVOCATION CERTIFICATE WITH ANYONE. #
#########################################################
\x1b[0m`);
}

module.exports = {
	Init: (openpgp) => {
		return init(openpgp)
	}
}
