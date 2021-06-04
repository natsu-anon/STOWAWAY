const openpgp = require('openpgp');
const { access, natoPhrase, writeFile, readFile } = require('./utils.js');

let BEST_PRACTICES = '{underline}STOWAWAY BEST PRACTICES{/underline}\n\n';
BEST_PRACTICES += '1. Always check that your key\'s nickname & fingerprint match what you remember.\n';
BEST_PRACTICES += '2. NEVER SHARE NEITHER YOUR PRIVATE KEY, YOUR PASSPHRASE, NOR YOUR REVOCATION CERTIFICATE WITH ANYONE.\n';
BEST_PRACTICES += '3. Write down your passphrase on a piece of paper DO NOT SAVE IT ON ANY NETWORKED DEVICE.\n';
BEST_PRACTICES += "4. Move the newly generated 'stowaway.revoke' to an offline storage device (e.g. USB flash drive) & ";
BEST_PRACTICES += 'delete any local copies left on your computer.\n';
// BEST_PRACTICES += '5. If you ever lose or forget your passphrase you MUST revoke your current private key in order to use STOWAWAY (see README.txt).\n';
BEST_PRACTICES += '5. IMMEADIATELY REVOKE YOUR PRIVATE KEY if you think anyone has your private key with or without the passphrase (see README.txt).';


function existingKey (lockedKey, keyPath, revocationPath, stowaway, client, cli) {
	const challenge = natoPhrase();
	return new Promise((resolve, reject) => {
		cli.toggleQuestion({
			text: 'Enter key passphrase then press [Enter] to continue; Press [Escape] to begin key revocation',
			censor: true,
			callback: phrase => {
				openpgp.decryptKey({
					privateKey: lockedKey,
					passphrase: phrase
				})
				.then(key => {
					resolve({ key, passphrase: phrase });
				})
				.catch(() => {
					reject(Error('Failed to decrypt key!  Consider revoking your key if you have forgotten your password!'));
				});
			}
		},
		{
			text: `Enter {underline}${challenge}{/underline} then press [Enter] to revoke your key THIS IS IRREVERSIBLE; Press [Escape] to decrypt key.`,
			callback: input => {
				if (input.toUpperCase() === challenge) {
					readFile(revocationPath)
					.then(data => {
						cli.cat('{black-fg}{yellow-bg}REVOCATION PROCESS INITIATED!{/}');
						generateKey(keyPath, revocationPath, cli, false)
						.then(({ key, revocationCertificate, passphrase }) => {
							stowaway.revokeKey(client, lockedKey, key, data)
							.then(k => {
								openpgp.encryptKey({
									privateKey: k,
									passphrase
								})
								.then(encryptedKey => {
									return Promise.all([
										writeFile(keyPath, encryptedKey.armor()),
										writeFile(revocationPath, revocationCertificate)
									]);
								})
								.then(() => {
									resolve({ key: k, passphrase });
								});
							})
							.catch(reject);
						})
						.catch(reject);
					})
					.catch(() => {
						reject(Error('Error while attempting to read armored revocation certificate'));
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

async function generateKey (keyPath, revocationPath, cli, writeFlag) {
	const nickname = await cli.question('Enter a nickname for your key then press [Enter] to continue').promise;
	if (nickname === '') {
		await cli.notify('Must enter a valid nickname!  Trying again!');
		return await generateKey(keyPath, revocationPath, cli, writeFlag);
	}
	const phrase = await cli.question('Enter a passphrase to encrypt your key with then press [Enter] to continue', true).promise;
	if (phrase === '') {
		await cli.notify('Must enter a valid passphrase!  Trying again!');
		return await generateKey(keyPath, revocationPath, cli, writeFlag);
	}
	else {
		const temp = await cli.question('Re-enter the passphrase then press [Enter] to continue', true).promise;
		if (phrase === temp) {
			const { key, revocationCertificate } = await openpgp.generateKey({
				type: 'ecc',
				curve: 'curve25519',
				passphrase: phrase,
				userIDs: [{ name: nickname }]
			});
			cli.log(`\t- key nickanme: {underline}${nickname}{/}`);
			cli.log(`\t- key fingerprint: {underline}${key.getFingerprint()}{/}`);
			if (writeFlag) {
				await writeFile(keyPath, key.armor());
				await writeFile(revocationPath, revocationCertificate);
			}
			await cli.notify(BEST_PRACTICES);
			return {
				key: await openpgp.decryptKey({
					privateKey: key,
					passphrase: phrase
				}),
				passphrase: phrase,
				revocationCertificate
			};
		}
		else {
			await cli.notify('Passphrases do not match!  Trying again!');
			return await generateKey(keyPath, revocationPath, cli, writeFlag);
		}
	}
}

function init (keyPath, revocationPath, stowaway, client, cli) {
	return new Promise((resolve, reject) => {
		cli.log('\t- checking for existing key... ');
		access(keyPath)
		.then(() => {
			readFile(keyPath)
			.then(data => {
				return openpgp.readKey({ armoredKey: data });
			})
			.then(key => {
				cli.cat('{green-fg}Found a key file!{/}');
				cli.log(`\t- key nickname: {underline}${key.getUserIDs()}{/}`);
				cli.log(`\t- key fingerprint: {underline}${key.getFingerprint()}{/} `);
				return existingKey(key, keyPath, revocationPath, stowaway, client, cli);
			})
			.then(({ key, passphrase }) => { resolve({ key, passphrase }); })
			.catch(reject);
		})
		.catch(() => {
			cli.cat('{yellow-fg}No existing keys found!{/}');
			cli.log('\t- Generating new private key... ');
			generateKey(keyPath, revocationPath, cli, true)
			.then(({ key, passphrase }) => { resolve({ key, passphrase }); })
			.catch(reject);
		});
	});
}

async function bruh () {
	const { key } = await openpgp.generateKey({
		type: 'ecc',
		curve: 'curve25519',
		userIDs: [{ name: 'BRUH' }]
	});
	return { key, passphrase: 'abc' };
}

module.exports = init;
