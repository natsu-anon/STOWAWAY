const { writeFileSync, readFileSync, } = require('fs');
const openpgp = require('openpgp');

const pubPath = './public_key';
const priPath = './private_key';
const revPath = './revocation_certificate';


async function test () {
	const { key, publicKeyArmored, privateKeyArmored, revocationCertificate } = await openpgp.generateKey({
		userIds: [{ name: 'Spurdo Spadre'}, {email: 'fake@gmail.com' }],
		curve: 'curve25519',
	});
	const { key: k2, privateKeyArmored: pka, revocationCertificate:r2 } = await openpgp.generateKey({
		userIds: [{ name: 'John Doe'}],
		curve: 'curve25519',
	});
	console.log(`${pka}`);
	console.log(r2);
	console.log(`
fingerprint: ${key.getFingerprint()}
userIds: ${key.getUserIds()}
	`);
	// for (let i = 0; i < signedKey.users.Length; i++) {
	// 	console.log(signedKey.users[i]);
	// }

	// SERIALIZATING

	/*
	writeFileSync(pubPath, publicKeyArmored);
	writeFileSync(priPath, privateKeyArmored);
	writeFileSync(revPath, revocationCertificate);
	const { keys: [ pubKey ] } = await openpgp.key.readArmored(readFileSync(pubPath, 'utf8'));
	const { keys: [ priKey ] } = await openpgp.key.readArmored(readFileSync(priPath, 'utf8'));
	// console.log({pubKey, priKey, });
	const revCert = readFileSync(revPath, 'utf8');

	// ENCRYPTING & DECRYPTING

	const message = openpgp.message.fromText("Oopah!");
	// console.log(message);
	const encrypted = await openpgp.encrypt({
		message: message,
		publicKeys: [pubKey, k2.toPublic()] ,
		// privateKeys: priKey,
	});
	// console.log(encrypted.data);
	// console.log(encrypted);
	const msgEncrypted = await openpgp.message.readArmored(encrypted.data);
	// console.log(enc_msg);
	const decrypted = await openpgp.decrypt({
		message: msgEncrypted,
		// publicKeys: pubKey, // if you pass in EVERY SINGLE public key you can check to see if this is a message from a known public key
		privateKeys: priKey,
	});
	console.log(decrypted.data);

	// REVOKING

	const fingerprint0 = k2.getFingerprint();
	console.log(`fingerprint0: ${k2.getFingerprint()}`);// \n\n${k2.toPublic().armor()}`);
	const { publicKey:rk, publicKeyArmored:rka } = await openpgp.revokeKey({
		key: k2,
		revocationCertificate: r2,
		reasonForRevocation: {
			flag: 0,
			string: "testing",
		},
	});
	const fingerprint1 = rk.getFingerprint();
	console.log(`fingerprint1: ${rk.getFingerprint()}`);
	console.log(`fingerprints match? ${fingerprint0 === fingerprint1}`);
	// console.log(k2);
	const { keys: [pk] } = await openpgp.key.readArmored(pka);
	const { privateKey:rpk } = await openpgp.revokeKey({
		key: pk,
		revocationCertificate: r2,
		reasonForRevocation: {
			flag: 0,
			string: "testing",
		},
	});
	console.log(rpk.getFingerprint());

	// MESSAGE SIGNING

	const { data: cleartext } = await openpgp.sign({
		message: openpgp.cleartext.fromText("Hello World!"),
		privateKeys: k2,
	});
	console.log(cleartext);
	// const { text, signature } = await openpgp.cleartext.readArmored(cleartext);
	const verification = await openpgp.verify({
		message: await openpgp.cleartext.readArmored(cleartext),
		publicKeys: [key.toPublic()]
	});
	console.log(verification);
	// const { keys: [ck] } = await openpgp.key.readArmored(text);
	// console.log(ck.getFingerprint());

	// const { signature } = await openpgp.sign({
	// 	message: openpgp.cleartext.fromText('CLEAR'),
	// 	privateKeys: pk,
	// 	detached: true
	// });
	// console.log(signature);
	*/

	// KEY (USER) SIGNING

	const { keys: [ publicKey ] } = await openpgp.key.readArmored(publicKeyArmored);
	const { keys: [ privateKey ] } = await openpgp.key.readArmored(privateKeyArmored);
	// console.log(publicKey);
	const signedKey = await publicKey.signAllUsers([ await k2.getSigningKey() ]);
	// console.log(publicKey);
	// console.log(signedKey);
	// console.log(signedKey.users);
	//console.log(signedKey.users[0]);
	// for (let i = 0; i < signedKey.users.length; i++) {
	// 	console.log(signedKey.users[i]);
	// }
	// for (user in signedKey.users) {
	// 	console.log(user);
	// }
	// console.log(privateKey.getFingerprint());
	console.log(publicKeyArmored.length);
	await privateKey.update(signedKey); // NOTE privateKey STAYS private
	await publicKey.update(signedKey);
	console.log(publicKey.armor().length); // LOOK, it's THICCER with the signature
	// console.log(`${privateKey.getFingerprint()} still private? ${privateKey.isPrivate()}`);
	// console.log(await publicKey.verifyAllUsers([k2.toPublic()]));
	// await publicKey0.update(signedKey);
	// console.log(publicKey1.users);
	// console.log(await signedKey.getKeyId());
	// console.log(await signedKey.verifyAllUsers(k2));
	// console.log(await publicKey0.verifyAllUsers(k2.toPublic()));
	// console.log(await publicKey0.verifyPrimaryUser());
	// console.log(signedKey.getFingerprint());


}

test().catch(err => {
	console.error(err);
});
