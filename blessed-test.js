/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - *
/* NOTE: IMPOSSIBLE TO DISCENERN SHIFT+ENTER FROM ENTER :^(
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -*/

const blessed = require('blessed');

const screen = blessed.screen({
	smartcsr: true,
	autopadding: true,
	tabSize: 2,
	// debug: true,
	dockborders: true,
	fullunicode: true, // allows for meme double-wide characters
});

const box = blessed.box({
	parent: screen,
	top: 0,
	left: 0,
	width: '100%',
	height: '100%',
	content: 'press keys...'
});

screen.on('keypress', (char, key) => {
	let temp = `character: ${char}`;
	for (const val in key) {
		temp += `\nkey.${val}: ${key[val]}`;
	}
	// box.setContent(`character: ${char}, full: ${key.full}`);
	box.setContent(temp);
	screen.render();
});

/*
screen.key(['delete', 'backspace'], () => {
	box.setContent('DELETE/BACKSPACE');
	screen.render();
});
*/

/*
const input = blessed.textbox({
	parent: screen,
	top: 0,
	left: 0,
	width: '100%',
	height: '100%',
	inputOnFocus: true
});
input.focus();
input.on('submit', () => {
	input.clearValue();
	screen.render();
});
input.onceKey('C-c', () => { process.exit(0); });
*/


screen.onceKey('C-c', () => { process.exit(0); });
screen.render();
