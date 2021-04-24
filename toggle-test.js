const blessed = require('blessed');

const screen = blessed.screen({
	smartcsr: true,
	autopadding: true,
	tabSize: 2,
	dockborders:true,
	fullunicode: true,
});
let flag = true;
const makeBox = str => {
	let box = blessed.box({
		parent: screen,
		width: '100%',
		height: '100%',
		content: str,
	});
	box.focus();
	screen.render();
	box.key(['tab'], () => {
		box.destroy();
		flag ? makeBox('GOODBYE') : makeBox('HENLO');
		flag = !flag;
	});
	return box;
};
makeBox('HENLO');
screen.key(['C-c'], () => {
	return process.exit(0);
});
