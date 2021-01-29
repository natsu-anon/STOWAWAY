const blessed = require('blessed');

const screen = blessed.screen({
	smartCSR: true,
	autoPadding: true,
	debug: true,
	dockBorders: true,
	fullUnicode: true, // allows for meme double-wide characters
});

const topbox = blessed.box({
	parent: screen,
	left: 'center',
	width: '100%',
	width: '100%',
	ch: '*',
	// keys: true,
	// vi: true,
	// border: { type: 'line' },
});

const box = blessed.textarea({
	parent: topbox,
	label: '[Enter] to enter text',
	// name: 'textbox',
	inputOnFocus: true,
	top: 'center',
	left: 'center',
	width: '90%',
	height: '50%',
	border: { type: 'line' },
	focus: { bg: 'white', fg: 'black' },
	// focus: { bg: 'yellow', fg: 'black' },
});
// const submit = blessed.button({
// 	parent: form,
// 	content: 'submit',
// 	left: 'center',
// 	top: '75%+2',
// 	height: 'shrink',
// 	width: 'shrink',
// 	fg: 'black',
// 	bg: 'cyan',
// 	padding: 1,
// 	focus: { inverse: true, },
// 	// border: { type: 'line' },
// });
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
// box.focus();

// NOTE it _HAS_ to be this way
// I think that while box has focus it stops events bubbling up to screen
box.key(['enter'], function (ch, key) {
	box.submit();
	box.clearValue();
	box.setLabel('[Enter] to enter text');
	screen.render();
});

box.key(['escape'], function (ch, key) {

	box.submit();
	// box.clearValue();
	box.setLabel('[Enter] to enter text');
	screen.render();
});

screen.key(['enter'], function (ch, key) {
	if (!box.focused) {
		box.setLabel('[Enter] to submit text, [Esc] to stop');
		screen.render();
		box.focus();
	}
});


// Quit on Escape, q, or Control-C.
screen.key(['escape', 'q', 'C-c'], function (ch, key) {
	return process.exit(0);
});

// screen.key(['enter'], function (ch, key) {
// });

// screen.on('keypress', function (ch, key) {
// 	screen.debug({ ch: ch, key: key});
// 	// screen.debug(key);
// 	// box.setValue(key);
// 	box.setValue(ch);
// });

// screen.append(form);
screen.render();
