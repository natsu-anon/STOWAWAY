const blessed = require('blessed');
const fs = require('fs');
const banner = fs.readFileSync('./banner.txt', 'utf8');
const lorem = fs.readFileSync('./lorem_ipsum.txt', 'utf8');

// Create a screen object.
const screen = blessed.screen({
	smartCSR: true,
	autoPadding: true,
	debug: true,
	dockBorders: true,
	fullUnicode: true, // allows for meme double-wide characters
});

screen.title = 'ＳＴＯＷＡＷＡＹ v0.0.0';

// Create a box perfectly centered horizontally and vertically.
const topBox = blessed.box({
	label: ' DO NOT SHARE YOUR TOKEN NOR YOUR PRIVATE KEY ',
	top: '0',
	left: '0',
	width: "100%",
	height: "100%",
	border: {
		type: 'line',
	},
	ch:'*'
});


const box0 = blessed.text({
	top: '0%+1',
	left: '0',
	width: '20%',
	height: '100%-3',
	label: " guilds/dms ",
	border: {
		type: 'line'
	}
});
topBox.append(box0);

const box1 = blessed.text({
	top: '0%+1',
	left: '20%',
	width: '80%-1',
	height: '95%-2',
	label: ' messages ',
	content: lorem,
	border: {
		type: 'line'
	},
	scrollable: true,
	scrollbar: {
		ch: '@',
	}
});
topBox.append(box1);

const box2 = blessed.textbox({
	top: '95%-1',
	left: '20%',
	width: '80%-1',
	height: '5%',
	tags: true,
	keys: true,
	// content: "{underline} encrypted {/} >",
	label: ' [i] to input{/} ',
	border: {
		type: 'line',
	},
});
box2.readInput(function (ch, key) {
	console.log(key);
});
topBox.append(box2);


// Quit on Escape, q, or Control-C.
screen.key(['escape', 'q', 'C-c'], function(ch, key) {
	return process.exit(0);
});

screen.key(['j'], function(ch, key) {
	box1.scroll(1);
	screen.render();
});

screen.key(['k'], function(ch, key) {
	box1.scroll(-1);
	screen.render();
});

let i = 0;

// setInterval(() => {
// 	box2.setContent(`${i++}`);
// 	screen.render();
// }, 500);

// Append our box to the screen.
screen.append(topBox);
screen.render()
