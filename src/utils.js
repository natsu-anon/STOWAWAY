const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const { Worker } = require('worker_threads');

const NATO = [
	'ALPHA',
	'BRAVO',
	'CHARLIE',
	'DELTA',
	'ECHO',
	'FOXTROT',
	'GOLF',
	'HOTEL',
	'INDIA',
	'JULIET',
	'KILO',
	'LIMA',
	'MIKE',
	'NOVEMBER',
	'OSCAR',
	'PAPA',
	'QUEBEC',
	'ROMEO',
	'SIERRA',
	'TANGO',
	'UNIFORM',
	'VICTOR',
	'WHISKEY',
	'X-RAY',
	'YANKEE',
	'ZULU'
];
// DO NOT TOUCH DO NOT TOUCH DO NOT TOUCH DO NOT TOUCH DO NOT TOUCH DO NOT TOUCH
const NONCE_CHALLENGE = 'XDD';
// const NONCE_CHALLENGE = ['LMAO', 'BRUH', 'MEME'];
// TOUCH OK TOUCH OK TOUCH OK TOUCH OK TOUCH OK TOUCH OK TOUCH OK TOUCH OK TOUCH
const NONCE_FUNC = `const crypto = require('crypto');
const { workerData, parentPort } = require('worker_threads');
const CHALLENGE = process.argv[2];
const len = CHALLENGE.length;
let nonce, temp;
do {
	nonce = Math.random().toString().slice(2);
	temp = crypto.createHash('sha512').update(workerData + nonce).digest('base64');
} while (temp.slice(0, len) !== CHALLENGE);
parentPort.postMessage(nonce);`;

function nonce (input, test) {
	if (test != null) {
		return hash(input + test).slice(0, NONCE_CHALLENGE.length) === NONCE_CHALLENGE;
	}
	else {
		return new Promise((resolve, reject) => {
			const worker = new Worker(NONCE_FUNC, {
				eval: true,
				argv: [ NONCE_CHALLENGE ],
				workerData: input
			});
			worker.once('message', resolve);
			worker.once('error', reject);
			worker.once('exit', code => {
				if (code !== 0) {
					reject(`non-zero exit code`);
				}
				worker.removeAllListeners();
			});
		});
	}
}

function hash (input) {
	return crypto.createHash('sha512').update(input).digest('base64');
}

function natoPhrase (length=3) {
	const temp = crypto.createHash('sha512').update(`${Date.now()}`).digest().slice(0, length);
	return [...temp].map(x => NATO[x % 26]).join(' ');
}

function pin (length=5) {
	const temp = crypto.createHash('sha512').update(`${Date.now()}`).digest().slice(0, length);
	return [...temp].map(x => x % 10).join('');
}

function access (path) {
	return new Promise((resolve, reject) => {
		fs.access(path, fs.constants.R_OK, err => {
			if (err != null) {
				reject(err);
			}
			else {
				resolve();
			}
		});
	});
}

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

function readFile (file, encoding='utf8') {
	return new Promise((resolve, reject) => {
		fs.readFile(file, encoding, (err, data) => {
			if (err != null) {
				reject(err);
			}
			else {
				resolve(data);
			}
		});
	});
}

function readUrl (url) {
	return new Promise((resolve, reject) => {
		https.get(url, response => {
			let buffer = Buffer.alloc(0);
			response.once('end', () => {
				if (response.complete) {
					resolve(buffer.toString());
				}
				else {
					reject(Error(`Connection was terminated while response from ${url} was still being set!`));
				}
			});
			response.on('data', data => {
				buffer = Buffer.concat([ buffer, Buffer.from(data) ]);
			});
		}).on('error', reject);
	});
}

function writeStream (file) {
	return fs.createWriteStream(file);
}

module.exports = {
	nonce,
	hash,
	access,
	writeFile,
	writeStream,
	readFile,
	readUrl,
	natoPhrase,
	pin,
};
