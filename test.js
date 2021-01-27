const openpgp = require('openpgp');

openpgp.generateKey({
	userIds: [{ name: 'Foo'}],
	curve: 'curve25519'
})
.then(({key, publicKeyArmored, privateKeyArmored, revocationCertificate }) => {
	// openpgp.key.readArmored(publicKeyArmored)
	openpgp.key.readArmored("foo")
	.then(({ keys, err }) => {
		console.log(keys);
		if (err != null) {
			console.log("FUG");
		}
		else {
			console.log("NO ERRORS");
		}
	});
	// .catch(console.log);
})
