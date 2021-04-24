const crypto = require('crypto');

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

function hash (str, length) {
	const temp = crypto.createHash('blake2s256').update(str).digest().slice(0, length);
	return [...temp].map(x => NATO[x % 26]).join(' ');
}

function phrase (length=3) {
	return hash(`${Date.now()}`, length);
}

module.exports = phrase;
