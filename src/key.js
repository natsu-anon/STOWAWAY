const openpgp = require('openpgp');

function init (keyPath, fs, cli) {
	cli.log("\t- checking for existing key... ");
	return new Promise((resolve, reject) => {
		fs.access(keyPath, fs.constants.R_OK, (error) => {
			if (error == null) {
				fs.readFile(keyPath, 'utf8' , (e, data) => {
					if (e) {
						reject(e);
					}
					else {
						openpgp.key.readArmored(data)
						.then(({ keys, err }) => {
							if (err == null) {
								resolve(keys[0]);
							}
							else {
								reject(err);
							}
						});
					}
				});
			}
			else {
				cli.cat('{yellow-fg}No existing keys found!{/}');
				cli.log('\t- Generating new keys...');
				cli.question("Enter a nickname to associate with your keys then press [ENTER] to continue")
				.then(name => {
					return openpgp.generateKey({
						userIds: [{ name: name }],
						curve: 'curve25519',
					});
				})
				.then(({ key, privateKeyArmored }) => {
					fs.writeFile(keyPath, privateKeyArmored, 'utf8', (err) => {
						if (err) {
							reject(err);
						}
						else {
							resolve(key);
						}
					});
				})
				.catch(reject);
			}
		});
	})
}

module.exports = init;
