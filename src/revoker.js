const fs = require('fs');
const openpgp = require('openpgp');

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

class Revoker {
	constructor (stowaway, client, keyPath, revocationPath) {
		this.stowaway = stowaway;
		this.client = client;
		this.keyPath = keyPath;
		this.revocationPath = revocationPath;
	}

	// assume it has the revocation certificate
	checkChallenge (input) {
		return input.toUpperCase() === this.challenge;
	}

	setKey (key) {
		this.key = key;
		return this;
	}

	setNickname (nickname) {
		this.nickname = nickname;
		return this;
	}

	setPassphrase (passphrase) {
		this.passphrase = passphrase;
		return this;
	}

	setRevocationCertificate (revocationCertificate) {
		this.revocationCertificate = revocationCertificate;
		return this;
	}

	async revoke () {
		if (this.passphrase != null && this.nickname != null && this.key != null && this.revocationCertificate != null) {
			let { key, revocationCertificate } = await openpgp.generateKey({
				type: 'ecc',
				curve: 'curve25519',
				passphrase: this.passphrase,
				userIds: [{
					name: this.nickname,
				}]
			});
			key = await openpgp.decryptKey({
				privateKey: key,
				passphrase: this.passphrase
			});
			try {
				key = await this.stowaway.revokeKey(this.client, this.key, key, this.revocationCertificate);
				await writeFile(this.revocationPath, revocationCertificate);
				await writeFile(this.keyPath, (await openpgp.encryptKey({
					privateKey: key,
					passphrase: this.passphrase
				})).armor());
				this.key = key;
				this.passphrase = null;
				const nickname = this.nickname;
				this.nickname = null;
				this.revocationCertificate = null;
				return { nickname: nickname, fingerprint: key.getFingerprint() };
			}
			catch (error) {
				throw error;
			}
		}
		else {
			throw Error('revocation values unset!');
		}
	}
}

async function test () {
	const fauxaway = {
		revokeKey: async (client, key0, key1, rCert) => {
			return key1;
		}
	};
	const keyPath = './_test.key';
	const revPath = './_test.revoke';
	const revoker = new Revoker(fauxaway, 0, keyPath, revPath);
	const { key, revocationCertificate } = await openpgp.generateKey({
		type: 'ecc',
		curve: 'curve25519',
		passphrase: '321',
		userIds: [{
			name: 'key0',
		}]
	});
	console.log(`Key0: ${key.getFingerprint()}`);
	revoker.setKey(key).setRevocationCertificate(revocationCertificate).setNickname('key1').setPassphrase('321');
	const { fingerprint } = await revoker.revoke();
	console.log(`Key1: ${fingerprint}`);
	fs.readFile(keyPath, 'utf8', (err, data) => {
		if (err != null) {
			throw err;
		}
		else {
			openpgp.readKey({ armoredKey: data })
			.then(key => {
				console.log(`disc fingerprint: ${key.getFingerprint()}`);
			});
		}
	});
}

module.exports = { Revoker, test };
