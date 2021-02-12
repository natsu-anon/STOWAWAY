const blessed = require('blessed');
const EventEmitter = require('events');
const FSM = require('./src/FSM/fsm.js');


const screen = blessed.screen({
	smartCSR: true,
	// autoPadding: true,
	debug: true,
	dockBorders: true,
	fullUnicode: true, // allows for meme double-wide characters
});


box = blessed.box({
	parent: screen,
	content: 'foo',
});

function render (func) {
	return () => {
		func()
		screen.render();
	}
}

const fsmDriver = new EventEmitter();
fsm = new FSM(driver);
fsm.on('enter server', render(() => { box.setContent('server navigation'); }));
fsm.on('enter dm', render(() => { box.setContent('dm navigation'); }));
fsm.on('enter input', render(() => { box.setContent('user input'); }));
fsm.on('enter message', render(() => { box.setContent('reading messages'); }));


// Quit on Escape, q, or Control-C.
screen.key(['escape', 'q', 'C-c'], function(ch, key) {
	return process.exit(0);
});

screen.key([

screen.render()

fsm.launch()
