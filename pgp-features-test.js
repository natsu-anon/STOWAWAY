const openpgp = require('openpgp');

function diff (s1, s2) {
	let res='';
	s2.split('').forEach((char, i) => {
		if (char != s1.charAt(i)) {
			res += char;
		}
	});
	return res;
}

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - *
/* KEY SIGNING & KEY REVOCATION
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -*/

async function main () {
	let { key: k0, privateKeyArmored: sk0, publicKeyArmored: pk0, revocationCertificate: rc0 } = await openpgp.generateKey({
		type: 'ecc',
		curve: 'curve25519',
		userIds: [{ name: "foo", comment: "STOWAWAY" }], // hashed discord snowflake
	});
	let { key: k1, privateKeyArmored: sk1, publicKeyArmored: pk1, revocationCertificate: rc1 } = await openpgp.generateKey({
		type: 'ecc',
		curve: 'curve25519',
		userIds: [{ name: "bar", comment: "STOWAWAY" }],
	});
	let { key: k2, privateKeyArmored: sk2, publicKeyArmored: pk2, revocationCertificate: rc2 } = await openpgp.generateKey({
		type: 'ecc',
		curve: 'curve25519',
		userIds: [{ name: "baz", comment: "STOWAWAY" }],
	});

	/*  KEY SIGNING  */

	let publicKey = await openpgp.readKey({ armoredKey: pk0 });
	console.log(`pre-sign public fingerprint: ${publicKey.getFingerprint()}`);
	publicKey = await publicKey.signPrimaryUser([k1, k2]);
	console.log(`post-sign public fingerprint: ${publicKey.getFingerprint()}`);
	// verify primary user
	let keys = [ k0.toPublic(), k1.toPublic(), k2.toPublic() ];
	let res = await publicKey.verifyPrimaryUser(keys);
	// NOTE USE a for-loop. Don't filter & foreach res
	for (let i = 0; i < res.length; i++) {
		if (res[i].valid) {
			let { user: u } = await keys[i].getPrimaryUser();
			console.log(`known signer: ${u.userId.name}`);
		}
	}
	// update private key with new signature -- armored private key looks similar but it has the new certs
	// update does not change the fingerprint -- which is what you WANT
	// public & private keys have the same fingerprint
	await k0.update(publicKey) // NOTE: await.  NOTE: ONLY WORKS IF FINGERPRINTS MATCH (very based)
	sk0 = k0.armor(); // write this to disk
	k0 = await openpgp.readKey({ armoredKey: sk0 });
	publicKey = await openpgp.readKey({ armoredKey: k0.toPublic().armor() });
	console.log("\x1b[32mAFTER UPDATE & SERIALIZATION & ALL THAT\x1b[0m");
	res = await publicKey.verifyPrimaryUser(keys);
	for (let i = 0; i < res.length; i++) {
		if (res[i].valid) {
			let { user: u } = await keys[i].getPrimaryUser();
			console.log(`\x1b[32mknown signer: ${u.userId.name}\x1b[0m`);
		}
	}
	// if fingerprints match you don't have to write your own public key to disc.  very noice.
	console.log(`public keys have same fingerprint? ${publicKey.hasSameFingerprintAs(await openpgp.readKey({ armoredKey: pk0 }))}`);
	// other users use update on the public keys they saved in their databases
	// JUST UPDATE DON'T COMPARE.  DON'T QUESTION JUST UPDATE IF FINGERPRINTS MATCH
	// etc. you can figure this bit while implementing.  I trust you.

	/*  KEY REVOKING  */

	// only revokes if key & cert match
	let { publicKey: rKey } = await openpgp.revokeKey({
		key: await openpgp.readKey({ armoredKey: pk1 }),
		revocationCertificate: rc1,
	});
	console.log(`revoked key matches original? ${rKey.hasSameFingerprintAs(await openpgp.readKey({armoredKey: pk1 }))}`);
	// console.log(revokedKeyArmored);
	let { key: k3, privateKeyArmored: sk3, publicKeyArmored: pk3, revocationCertificate: rc3 } = await openpgp.generateKey({
		type: 'ecc',
		curve: 'curve25519',
		userIds: [{ name: "baz", comment: "STOWAWAY" }],
	});
	// sign the revoked key with new key
	rKey = await rKey.signPrimaryUser([ k3 ]);
	console.log(`signed revoked key matches original? ${rKey.hasSameFingerprintAs(await openpgp.readKey({armoredKey: pk1 }))}`);
	console.log("signed revoked public key:");
	console.log(rKey.armor());
	console.log("new public key:");
	console.log(pk3);
	rKey.toPublic().getRevocationCertificate() // if there's not a revocation certificate this throws an error
	.then(async () => {
		// verify the original self-signature & new signature match -- only then does the recipient update their local shit
		res = await rKey.verifyPrimaryUser([ await openpgp.readKey({ armoredKey: pk1 }), k3.toPublic() ]);
		console.log(`key is revoked & check signature on revoked public key matches newly supplied public key: ${res[0].valid && res[1].valid}`);
	})
	.catch(err => { console.error(err); });
	// console.log(rKey.revocationSignatures[0]);
	// what happens if a user misses the original revocation but sees later signature messages????
	// bruh just send the revoked public key fuggit
	// BRUH.  JUST SEND THE ENTIRE REVOCATION KEY SERIRES & FINAL KEY -- THAT'S YOUR PROVENANCE
}

main();
