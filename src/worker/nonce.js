const crypto = require('crypto');
const { workerData, parentPort } = require('worker_threads');
const CHALLENGE = process.argv[2];
const len = CHALLENGE.length;
let nonce, temp;
do {
	nonce = `${Math.random()}`.slice(2);
	temp = crypto.createHash('sha512').update(workerData + nonce).digest('base64');
} while (temp.slice(0, len) !== CHALLENGE);
parentPort.postMessage(nonce);
