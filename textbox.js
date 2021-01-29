const blessed = require('blessed');

const screen = blessed.screen({
	smartCSR: true,
	autoPadding: true,
	debug: true,
	dockBorders: true,
	fullUnicode: true, // allows for meme double-wide characters
});

const form = blessed.form({
	parent: screen,
	left: 'center',
	width: '90%',
	ch: '*',
	keys: true,
	vi: true,
	// border: { type: 'line' },
});

const box = blessed.textarea({
	parent: form,
	label: 'USER INPUT',
	name: 'textbox',
	inputOnFocus: false,
	top: '0',
	left: '0',
	width: '50%',
	height: '50%',
	border: { type: 'line' },
	// focus: { bg: 'yellow', fg: 'black' },
});
const submit = blessed.button({
	parent: form,
	content: 'submit',
	left: '50%+1',
	fg: 'white',
	bg: 'green',
	focus: { inverse: true, },
});
// submit.on('press', () => {
// 	box.clearValue();
// });
// });
// const firstName = blessed.textbox({
//   parent: form,
//   name: 'firstname',
//   top: 4,
//   left: 5,
//   height: 3,
//   inputOnFocus: true,
//   content: 'first',
//   border: {
//     type: 'line'
//   },
//   focus: {
//     fg: 'blue'
//   }
// });
// box.focus();
// box.key(['enter'], function (ch, key) {
// 	console.log(box.value);
// 	box.clearValue();
// 	form.focusNext();
// });
// box.focus();


// Quit on Escape, q, or Control-C.
screen.key(['escape', 'q', 'C-c'], function (ch, key) {
	return process.exit(0);
});

screen.key(['enter'], function (ch, key) {
});

// screen.on('keypress', function (ch, key) {
// 	screen.debug({ ch: ch, key: key});
// 	// screen.debug(key);
// 	// box.setValue(key);
// 	box.setValue(ch);
// });

// screen.append(form);
screen.render();
