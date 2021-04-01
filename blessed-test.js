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
	box.setContent(`character: ${char}, full: ${key.full}`);
	screen.render();
});
screen.onceKey('C-c', () => { process.exit(0); });
screen.render();
