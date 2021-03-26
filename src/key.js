const fs = require('fs');
const openpgp = require('openpgp');
const crypto = require('crypto');

const phrase = require('./nato-phrase.js');

let WARNING = 'Write down your passphrase on a piece of paper.  ';
WARNING += 'STOWAWAY does not save your passphrase for additional security.\n';
WARNING += 'If you ever lose or forget your passphrase you will be \x1b[4mUNABLE TO RECOVER YOUR PRIVATE KEY\x1b[0m.  ';
WARNING += 'If that happens you will revoke your current private key then generate a new private key.\n';
WARNING += 'If you think anyone has your private key with or without the passphrase you should ';
WARNING += '\x1b[4mIMMEADIATELY REVOKE YOUR PRIVATE KEY\x1b[0m by following the revokation sequence.';

function writeFile (file, data, encoding='utf8') {
	return new Promise((resolve, reject) => {
		fs.writeFile(file, data, encoding, err => {
			if (err != null) {
				reject(err);
			}
			else {
				resolve();
			}
		});
	});
}

function existingKey (lockedKey, keyPath, revocationPath, stowaway, client, cli) {
	const challenge = phrase();
	return new Promise((resolve, reject) => {
		cli.toggleQuestion({
			text: 'Enter passphrase then press [Enter] to continue. Press [Escape] to begin key revocation',
			censor: true,
			callback: input => {
				openpgp.decryptKey({
					privateKey: lockedKey,
					passphrase: input
				})
				.then(resolve)
				.catch(() => {
					reject(Error('Failed to decrypt key!  Consider revoking your key if you have forgotten your password!'));
				});
			}
		},
		{
			text: `Enter '${challenge} then press [Enter] to revoke your key {underline}THIS IS IRREVERSIBLE{/underline}. Press [Escape] to decrypt key.`,
			callback: input => {
				if (input.toUpperCase() === challenge) {
					// read rcert from path
					fs.readFile(revocationPath, 'utf8', (err, data) => {
						if (err != null) {
							reject(Error('Error while attempting to read armored revocation certificate'));
						}
						else {
							// generate new key (DON'T WRITE TO FILE)
							// stowaway revoke
							// write new key & revocation cert to file
							this.generateKey(keyPath, revocationPath, client.user.id, cli, false)
							.then(({ key, revocationCertificate }) => {
								openpgp.readKey({ armoredKey: data })
								.then(certificate => {
									return stowaway.revoke(client, lockedKey, key, certificate);
								})
								.then(() => {
									return Promise.all([
										writeFile(keyPath, key.armor()),
										writeFile(revocationPath, revocationCertificate)
									]);
								})
								.then(() => {
									resolve({ key, revocationCertificate });
								})
								.catch(reject);
							})
							.catch(reject);
						}
					});
				}
				else {
					this.existingKey(lockedKey, keyPath, revocationPath, stowaway, client, cli)
					.then(resolve)
					.catch(reject);
				}
			}
		}, 'escape');
	});
}

function generateKey (keyPath, revocationPath, userId, cli, writeFlag) {
	return new Promise((resolve, reject) => {
		cli.question('Enter a passphrase to encrypt your key with then press [Enter] to continue', true)
		.then(phrase0 => {
			cli.question('Re-enter the passphrase then press [Enter] to continue', true)
			.then(phrase1 => {
				if (phrase0 === phrase1) {
					openpgp.generateKey({
						type: 'ecc',
						curve: 'curve25519',
						passphrase: phrase0,
						userIds: [{
							name: crypto.createHash('sha256').update(userId).digest('base64'),
							comment: 'STOWAWAY'
						}]
					})
					.then(({ key, revocationCertificate }) => {
						openpgp.decryptKey({
							privateKey: key,
							passphrase: phrase1
						})
						.then(unlockedKey => {
							console.log(WARNING);
							console.question('After reading the above press [Enter] to continue...')
							.then(() => {
								if (writeFlag) {
									return Promise.all([
										writeFile(keyPath, key.armor()),
										writeFile(revocationPath, revocationCertificate)
									])
									.then(() => {
										resolve({ unlockedKey, revocationCertificate });
									})
									.catch(reject);
								}
								else {
									resolve({ key: unlockedKey, revocationCertificate });
								}
							});
						})
						.catch(reject);
					})
					.catch(reject);
				}
				else {
					console.log('passphrases do not match!  Trying again...');
					generateKey(keyPath, revocationPath, userId, cli, writeFlag)
					.then(resolve)
					.catch(reject);
				}
			})
			.catch(reject);
		})
		.catch(reject);
	});
}

function init (keyPath, revocationPath, stowaway, client, cli) {
	cli.log('\t- checking for existing key... ');
	return new Promise((resolve, reject) => {
		fs.access(keyPath, fs.constants.R_OK, error => {
			if (error == null) {
				fs.readFile(keyPath, 'utf8' , (err, data) => {
					if (err) {
						reject(err);
					}
					else {
						openpgp.readKey({ armoredKey: data })
						.then(key => {
							return existingKey(key, revocationPath, stowaway, client, cli);
						})
						.then(resolve)
						.catch(reject);
					}
				});
			}
			else {
				cli.cat('{yellow-fg}No existing keys found!{/}');
				cli.log('\t- Generating new keys...');
				generateKey(client.user.id, cli, true)
				.then(({ key }) => { resolve(key); })
				.catch(reject);
			}
		});
	});
}

module.exports = init;
