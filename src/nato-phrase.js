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
	return crypto.createHash('sha256')
		.update(str)
		.digest()
		.slice(0, length)
		.map(x => NATO[x % NATO.length])
		.join(' ');
}

function phrase (length=3) {
	return hash(`${Date.now()}`, length);
}

module.exports = phrase;
