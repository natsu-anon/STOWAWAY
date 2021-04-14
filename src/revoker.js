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
			const { key, revocationCertificate } = await openpgp.generateKey({
				type: 'ecc',
				curve: 'curve25519',
				passphrase: this.passphrase,
				userIds: [{
					name: this.nickname,
				}]
			});
			this.stowaway.revokeKey(this.client, this.key, key, this.revocationCertificate);
			this.key = key;
			await writeFile(this.revocationPath, revocationCertificate);
			await writeFile(this.keyPath, key);
			return key;
		}
	}
}

module.exports = Revoker;
