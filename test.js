const BInput = require('./src/blessed-input.js');

BInput("enter bot API token, then press [Enter] to continue...", true)
.then(console.log);


/*
const foo = new Promise((resolve, reject) => {
	try {
		const input = new BInput("send help");
		input.textbox.once('submit', (val) => {
			input.screen.destroy();
			console.log(val.length);
			resolve(val);
		});
	}
	catch (err) {
		reject(err);
	}
})
*/
/*
const openpgp = require('openpgp');

// openpgp.generateKey({
// 	userIds: [{ name: 'Foo'}],
// 	curve: 'curve25519'
// })
// .then(({key, publicKeyArmored, privateKeyArmored, revocationCertificate }) => {
// 	// openpgp.key.readArmored(publicKeyArmored)
// 	openpgp.key.readArmored("foo")
// 	.then(({ keys, err }) => {
// 		console.log(keys);
// 		if (err != null) {
// 			console.log("FUG");
// 		}
// 		else {
// 			console.log("NO ERRORS");
// 		}
// 	});
// 	// .catch(console.log);
// })

async function main () {
	const { key:k1 } = await openpgp.generateKey({
		userIds: [{ name: 'Foo'}],
		curve: 'curve25519'
	});
	const { key:k2 } = await openpgp.generateKey({
		userIds: [{ name: 'Bar'}],
		curve: 'curve25519'
	});
	const message = openpgp.message.fromText("Hello, World!");
	const encrypted = await openpgp.encrypt({
		message: message,
		// publicKeys: [k1.toPublic(), k2.toPublic()]
		publicKeys: [k2.toPublic()]
	})
	console.log(encrypted.data);
	const armoredMessage = await openpgp.message.readArmored(encrypted.data);
	openpgp.decrypt({
		message: armoredMessage,
		privateKeys: k2
	})
	.then((msg) => { console.log(msg); })
	.catch(console.err);

	// console.log(decrypted);
}

main();
*/
