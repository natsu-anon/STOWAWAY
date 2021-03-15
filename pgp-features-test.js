const openpgp = require('openpgp');
const crypto = require('crypto');

function diff (s1, s2) {
	let res='';
	s2.split('').forEach((char, i) => {
		if (char !== s1.charAt(i)) {
			res += char;
		}
	});
	return res;
}

function sleep (ms) {
	return new Promise(r => setTimeout(r, ms));
}

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - *
/* KEY SIGNING & ENCRYPTING JSON (feat. parsing) & KEY REVOCATION
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -*/

async function main () {
	let { key: k0, privateKeyArmored: sk0, publicKeyArmored: pk0, revocationCertificate: rc0 } = await openpgp.generateKey({
		type: 'ecc',
		curve: 'curve25519',
		userIds: [{ name: 'foo', comment: 'STOWAWAY' }], // hashed discord snowflake
	});
	const { key: k1, privateKeyArmored: sk1, publicKeyArmored: pk1, revocationCertificate: rc1 } = await openpgp.generateKey({
		type: 'ecc',
		curve: 'curve25519',
		userIds: [{ name: 'bar', comment: "STOWAWAY" }],
	});
	let { key: k2, privateKeyArmored: sk2, publicKeyArmored: pk2, revocationCertificate: rc2 } = await openpgp.generateKey({
		type: 'ecc',
		curve: 'curve25519',
		userIds: [{ name: 'baz', comment: 'STOWAWAY' }],
	});


	/*  KEY SIGNING  */


	console.log("\x1b[32m#### KEY SIGNING\n\x1b[0m");
	let publicKey = await openpgp.readKey({ armoredKey: pk0 });
	console.log(`pre-sign public fingerprint: ${publicKey.getFingerprint()}`);
	publicKey = await publicKey.signPrimaryUser([k1]);
	console.log(`post-sign public fingerprint: ${publicKey.getFingerprint()}`);
	// verify primary user
	let keys = [ k0.toPublic(), k1.toPublic(), k2.toPublic() ];
	let res = await publicKey.verifyPrimaryUser(keys);
	console.log(res);
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
	await k0.update(publicKey); // NOTE: await.  NOTE: ONLY WORKS IF FINGERPRINTS MATCH (very based)
	sk0 = k0.armor(); // write this to disk
	k0 = await openpgp.readKey({ armoredKey: sk0 });
	publicKey = await openpgp.readKey({ armoredKey: k0.toPublic().armor() });
	console.log('\x1b[33mAFTER UPDATE & SERIALIZATION & ALL THAT\x1b[0m');
	res = await publicKey.verifyPrimaryUser(keys);
	for (let i = 0; i < res.length; i++) {
		if (res[i].valid) {
			const { user: u } = await keys[i].getPrimaryUser();
			console.log(`\x1b[33mknown signer: ${u.userId.name}\x1b[0m`);
		}
	}
	// if fingerprints match you don't have to write your own public key to disc.  very noice.
	console.log(`public keys have same fingerprint? ${publicKey.hasSameFingerprintAs(await openpgp.readKey({ armoredKey: pk0 }))}`);
	// other users use update on the public keys they saved in their databases
	// JUST UPDATE DON'T COMPARE.  DON'T QUESTION JUST UPDATE IF FINGERPRINTS MATCH
	// etc. you can figure this bit while implementing.  I trust you.


	/*  JSON & MESSAGE SIGNING TESTING  */


	console.log('\x1b[32m\n#### JSON TESTING\n\x1b[0m');
	let json = JSON.stringify({ some: 'json', more: 'database usage' }, null, '\t');
	console.log('encrypted json:');
	let encrypted = await openpgp.encrypt({
		message: openpgp.Message.fromText(json), // you MUST stringify your json
		publicKeys: await openpgp.readKey({ armoredKey: pk1 }),
		privateKeys: k0,

	});
	console.log(encrypted);
	let decrypted = await openpgp.decrypt({
		message: await openpgp.readMessage({ armoredMessage: encrypted }),
		publicKeys: await openpgp.readKey({ armoredKey: pk0 }),
		privateKeys: k1,
	});
	console.log('decrypted message:');
	console.log(decrypted);
	if (decrypted.signatures.length > 0) {
		console.log(`signature verified? ${await decrypted.signatures[0].verified} (i.e. is it from whomstve I think it's from?)`);
	}
	else {
		console.log('no signature on message :c');
	}
	console.log('parsed json:');
	console.log(JSON.parse(decrypted.data));


	console.log('\x1b[32m\n#### PARTIAL ENCRYPTION\n\x1b[0m');
	encrypted = await openpgp.encrypt({
		message: openpgp.Message.fromText(JSON.stringify({ content: 'HENLO!' }, null, '\t')),
		publicKeys: await openpgp.readKey({ armoredKey: pk1 }),
		privateKeys: k0,
	});
	json = JSON.stringify({ type: 'encrypted', encrypted: encrypted }, null, '\t'); // this is what's attached
	console.log('mixed encryption stringified json:');
	console.log(json);
	const parsed = JSON.parse(json);
	// let message = openpgp.Message.fromText({ armoredMessage: parsed.encrypted });
	if (parsed.type.toLowerCase() === 'encrypted') {
		decrypted = await openpgp.decrypt({
			message: await openpgp.readMessage({ armoredMessage: parsed.encrypted }),
			publicKeys: await openpgp.readKey({ armoredKey: pk0 }),
			privateKeys: k1,
		});
		console.log(JSON.parse(decrypted.data));
	}


	/*  KEY REVOKING  */


	// NOTE key.getRevocationCertificate() does not give you the revocation certificate that revokes the key
	console.log('\x1b[32m\n#### KEY REVOKING\n\x1b[0m');
	// only revokes if key & cert match
	let { publicKey: rKey } = await openpgp.revokeKey({
		key: await openpgp.readKey({ armoredKey: pk1 }),
		revocationCertificate: rc1,
	});
	console.log(rKey);
	console.log(await k1.revoke());
	return;
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
	try {
		await k3.toPublic().getRevocationCertificate(); // if there's not a revocation certificate this throws an error
		res = await rKey.verifyPrimaryUser([ await openpgp.readKey({ armoredKey: pk1 }), k3.toPublic() ]);
		console.log(`key is revoked & check signature on revoked public key matches newly supplied public key: ${res[0].valid && res[1].valid}`);
	}
	catch (err) {
		console.error(err.message);
	}
	// console.log(rKey.revocationSignatures[0]);
	// what happens if a user misses the original revocation but sees later signature messages????
	// bruh just send the revoked public key fuggit
	// BRUH.  JUST SEND THE ENTIRE REVOCATION KEY SERIRES & FINAL KEY -- THAT'S YOUR PROVENANCE


	/*  HASHED FINGERPRINTS  */


	console.log('\x1b[32m\n#### FINGERPRINT HASHING\n\x1b[0m');
	const fingerprint = k0.getFingerprint();
	console.log(`fingerprint: ${fingerprint}`);
	console.log(crypto.createHash('sha256').update(fingerprint).digest('base64')); // use base64
	console.log(crypto.createHash('sha224').update(fingerprint).digest('base64')); // use base64
	console.log(crypto.createHash('sha1').update(fingerprint).digest('base64'));


	/*  openpgp.readKey()  */


	console.log('\x1b[32m\n#### OPENPGP.READKEY() \n\x1b[0m');
	const armoredKey = k0.armor();
	openpgp.readKey({ armoredKey })
	.then(key => {
		// console.log(key);
		return openpgp.readKeys({ armoredKeys: pk0+pk2 });
	})
	.then(keys => {
		console.log(keys);
		return openpgp.readKey({ armoredKey: 'bruh' });
	})
	.catch(err => {
		console.error(err);
	});

	console.log('\x1b[32m\n#### OPENPGP.READKEY() \n\x1b[0m');

	/*  openpgp.readMessage()  */


	console.log('\x1b[32m\n#### OPENPGP.READMESSAGE() \n\x1b[0m');
	const armoredMessage = 'bruh';
	openpgp.readMessage({ armoredMessage })
	.then(res => {
		console.log(res);
	})
	.catch(err => {
		console.error(err);
	});



}

main();
