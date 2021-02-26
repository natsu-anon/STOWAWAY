const process = require('process');
const readline = require('readline');

const rl = readline.createInterface({
rl.resume();

process.stdin.on('keypress', (c, k) => {
	console.log(c);
	console.log(k);
});
