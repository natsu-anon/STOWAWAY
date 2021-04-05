const fs = require('fs');
const openpgp = require('openpgp');
const crypto = require('crypto');

const phrase = require('./nato-phrase.js');

let BEST_PRACTICES = '{underline}STOWAWAY BEST PRACTICES{/underline}\n\n';
BEST_PRACTICES += '1. Always check that your key\'s nickname & fingerprint match what you remember.\n';
BEST_PRACTICES += '2. NEVER SHARE NEITHER YOUR PRIVATE KEY, YOUR PASSPHRASE, NOR YOUR REVOCATION CERTIFICATE WITH ANYONE.\n';
BEST_PRACTICES += '3. Write down your passphrase on a piece of paper DO NOT SAVE IT ON ANY NETWORKED DEVICE.\n';
BEST_PRACTICES += "4. Move the newly generated 'stowaway.revoke' to an offline storage device (e.g. USB flash drive) & ";
BEST_PRACTICES += 'delete any local copies left on your computer.\n';
// BEST_PRACTICES += '5. If you ever lose or forget your passphrase you MUST revoke your current private key in order to use STOWAWAY (see README.txt).\n';
BEST_PRACTICES += '5. IMMEADIATELY REVOKE YOUR PRIVATE KEY if you think anyone has your private key with or without the passphrase (see README.txt).';

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
			text: 'Enter passphrase then press [Enter] to continue; Press [Escape] to begin key revocation',
			censor: true,
			callback: phrase => {
				openpgp.decryptKey({
					privateKey: lockedKey,
					passphrase: phrase
				})
				.then(resolve)
				.catch(() => {
					reject(Error('Failed to decrypt key!  Consider revoking your key if you have forgotten your password!'));
				});
			}
		},
		{
			text: `Enter '${challenge}' then press [Enter] to revoke your key THIS IS IRREVERSIBLE; Press [Escape] to decrypt key.`,
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
							cli.cat('{black-fg}{yellow-bg}REVOCATION PROCESS INITIATED!{/}');
							generateKey(keyPath, revocationPath, client.user.id, cli, false)
							.then(({ key, revocationCertificate, passphrase }) => {
								stowaway.revokeKey(client, lockedKey, key, data)
								.then(signedKey => {
									openpgp.encryptKey({
										privateKey: signedKey,
										passphrase
									})
									.then(encryptedKey => {
										return Promise.all([
											writeFile(keyPath, encryptedKey.armor()),
											writeFile(revocationPath, revocationCertificate)
										]);
									})
									.then(() => {
										resolve(signedKey);
									});
								})
								.catch(reject);
							})
							.catch(reject);
						}
					});
				}
				else {
					existingKey(lockedKey, keyPath, revocationPath, stowaway, client, cli)
					.then(resolve)
					.catch(reject);
				}
			}
		}, 'escape');
	});
}

function generateKey (keyPath, revocationPath, userId, cli, writeFlag) {
	return new Promise((resolve, reject) => {
		cli.question('Enter a nickname for your key then press [Enter] to continue')
		.then(nickname => {
			cli.question('Enter a passphrase to encrypt your key with then press [Enter] to continue', true)
			.then(phrase0 => {
				cli.question('Re-enter the passphrase then press [Enter] to continue', true)
				.then(phrase1 => {
					if (phrase0 === phrase1) {
						if (phrase0 === '') {
							cli.notify('Must enter a valid passphrase!  Trying again!')
							.then(() => {
								return generateKey(keyPath, revocationPath, userId, cli, writeFlag);
							})
							.then(resolve)
							.catch(reject);
						}
						else {
							openpgp.generateKey({
								type: 'ecc',
								curve: 'curve25519',
								passphrase: phrase0,
								userIds: [{
									name: nickname,
								}]
							})
							.then(({ key, revocationCertificate }) => {
								cli.log(`\t- Key nickanme: {underline}${nickname}{/}, key fingerprint: {underline}${key.getFingerprint()}{/}`);
								if (writeFlag) {
									cli.log('\t- waiting to write to disk... ');
								}
								cli.notify(BEST_PRACTICES)
								.then(() => {
									if (writeFlag) {
										return Promise.all([
											writeFile(keyPath, key.armor()),
											writeFile(revocationPath, revocationCertificate)
										])
										.then(() => {
											return openpgp.decryptKey({
												privateKey: key,
												passphrase: phrase0
											});
										})
										.then(unlockedKey => {
											resolve({
												key: unlockedKey,
												passphrase: phrase0,
												revocationCertificate
											});
										})
										.catch(reject);
									}
									else {
										openpgp.decryptKey({
											privateKey: key,
											passphrase: phrase0
										})
										.then(unlockedKey => {
											resolve({
												key: unlockedKey,
												passphrase: phrase0,
												revocationCertificate
											});
										})
										.catch(reject);
									}
								})
								.catch(reject);
							})
							.catch(reject);
						}
					}
					else {
						cli.notify('Passphrases do not match!  Trying again!')
						.then(() => {
							return generateKey(keyPath, revocationPath, userId, cli, writeFlag);
						})
						.then(resolve)
						.catch(reject);
					}
				})
				.catch(reject);
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
							cli.cat('{green-fg}Found a key file!{/}');
							// cli.log(`\t- old key fingerprint: {underline}${key.getFingerprint()}{/} `);
							cli.log(`\t- key nickname: {underline}${key.getUserIds()}{/}, key fingerprint: {underline}${key.getFingerprint()}{/} `);
							return existingKey(key, keyPath, revocationPath, stowaway, client, cli);
						})
						.then(resolve)
						.catch(reject);
					}
				});
			}
			else {
				cli.cat('{yellow-fg}No existing keys found!{/}');
				cli.log('\t- Generating new private key... ');
				generateKey(keyPath, revocationPath, client.user.id, cli, true)
				.then(({ key }) => { resolve(key); })
				.catch(reject);
			}
		});
	});
}

module.exports = init;
