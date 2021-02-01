const blessed = require('blessed');
const fs = require('fs');
const banner = fs.readFileSync('./banner.txt', 'utf8');
const lorem = fs.readFileSync('./lorem_ipsum.txt', 'utf8');

const spinner = [
	"[@               ]",
	"[ @              ]",
	"[  @             ]",
	"[   @            ]",
	"[    @           ]",
	"[     @          ]",
	"[      @         ]",
	"[       @        ]",
	"[        @       ]",
	"[         @      ]",
	"[          @     ]",
	"[           @    ]",
	"[            @   ]",
	"[             @  ]",
	"[              @ ]",
	"[               @]",
	"[              @ ]",
	"[             @  ]",
	"[            @   ]",
	"[           @    ]",
	"[          @     ]",
	"[         @      ]",
	"[        @       ]",
	"[       @        ]",
	"[      @         ]",
	"[     @          ]",
	"[    @           ]",
	"[   @            ]",
	"[  @             ]",
	"[ @              ]",
];

// Create a screen object.
const screen = blessed.screen({
	smartCSR: true,
	// autoPadding: true,
	debug: true,
	dockBorders: true,
	fullUnicode: true, // allows for meme double-wide characters
});

screen.title = 'ＳＴＯＷＡＷＡＹ v1776';

// access width/height of box AFTER render via box.width & box.height

blessed.box({
	parent: screen,
	tags: true,
	content: 'DO NOT SHARE `app.token` NOR `key.spk`',
	left: 0,
	top: 0,
	width: 40,
	height: 1,
	// bg: 'green',
	fg: 'yellow',
	padding : {
		top: 0,
		right: 1,
		bottom: 0,
		left: 1,
	},
});

const newsBox = blessed.box({
	parent: screen,
	left: 40,
	top: 0,
	width: '100%-40',
	height: 1,
	align: 'right',
	content: 'notifications appear here.  Blue background for successful handshakes. Green for encrypted messages.  yellow for plaintext.  red for errors.',
	hidden: 'true',
	padding : {
		top: 0,
		right: 1,
		bottom: 0,
		left: 1,
	},
});

const navigationBox = blessed.box({
	parent: screen,
	left: 0,
	top: 1,
	width: 40,
	tags: true,
	height: '100%-1',
	label: 'SERVERS/DIRECT MESSAGES',
	content: `[-] {underline}server 1{/}
  > channel 1
  {underline}channel 2{/}
[+] server 2
[-] server3
  [+] super channel1
  [-]super channel 2
    channel A
    channel B`,
	scrollable: true,
	scrollbar: {
		bg: 'white',
		// ch: '@',
	},
	border: {
		type: 'line',
	},
	padding: 1,
})

const channelBox = blessed.box({
	parent: screen,
	left:40,
	top: 1,
	height:'100%-4',
	width: '100%-40',
	padding: 1,
	scrollable: true,
	scrollbar: {
		bg: 'green',
		// ch: '@',
	},
	label: 'server 1 #channel 2',
	border: {
		type: 'line',
		fg: 'green',
	},
	content: lorem,
})

const inputBox = blessed.box({
	parent: screen,
	left: 40,
	top: '100%-3',
	label: "ENCRYPTED/PLAINTEXT",
	width: '100%-40',
	height: 3,
	content: "your message here",
	border: {
		type: 'line',
	},
	padding : {
		top: 0,
		right: 1,
		bottom: 0,
		left: 1,
	},
});

const popupBox = blessed.box({
	parent: screen,
	hidden: true,
	label: 'fugggg',
	left: 'center',
	top: 'center',
	height: 5,
	width: 30,
	padding: 1,
	align: 'center',
	content: 'POP',
	border : {
		type: 'line',
		fg: 'green',
	},
	fg: 'green',
	tags: true,
})

function notify (text, color) {
	newsBox.setContent(text);
	newsBox.show();
	newsBox.style = {
		fg: 'black',
		bg: color,
	};
	screen.render();
	return new Promise((resolve) => {
		setTimeout(() => {
			newsBox.style = {
				fg: color,
				bg: 'black',
			};
			screen.render();
			resolve();
		}, 100);
	})
	.then(() => {
		return new Promise((resolve) => {
			setTimeout(() => {
				newsBox.style = {
					fg: 'black',
					bg: color,
				};
				screen.render();
				resolve();
			}, 100);
		})
	})
	.then(() => {
		return new Promise((resolve) => {
			setTimeout(() => {
				newsBox.style = {
					fg: color,
					bg: 'black',
				};
				screen.render();
				resolve();
			}, 100);
		})
	})
	.then(() => {
		return new Promise((resolve) => {
			setTimeout(() => {
				newsBox.style = {
					fg: 'black',
					bg: color,
				};
				screen.render();
				resolve();
			}, 100);
		})
	})
	.then(() => {
		return new Promise((resolve) => {
			setTimeout(() => {
				newsBox.hide();
				screen.render();
				resolve();
			}, 3000);
		})
	});
}
function popup (label) {
	popupBox.show();
	popupBox.setLabel(`{green-fg}${label}{/}`);
	let timeout;
	const cycle = function (i) {
		popupBox.setContent(spinner[i++]);
		screen.render();
		timeout = setTimeout(() => {
			cycle(i % spinner.length);
		}, 40);
	}
	cycle(0);
	return () => {
		clearTimeout(timeout);
		popupBox.hide();
		screen.render();
	};
}


// Quit on Escape, q, or Control-C.
screen.key(['escape', 'q', 'C-c'], function(ch, key) {
	return process.exit(0);
});


screen.render()


setTimeout(() => {
	notify("ENCRYPTED MESSAGE", 'green')
	.then(() => {
		return new Promise(resolve => setTimeout(resolve, 500));
	})
	.then(() => {
		return notify("HANDSHAKE", 'cyan')
	})
	.then(() => {
		return new Promise(resolve => setTimeout(resolve, 500));
	})
	.then(() => {
		return notify("PLAINTEXT", 'yellow')
	})
	.then(() => {
		return new Promise(resolve => setTimeout(resolve, 500));
	})
	.then(() => {
		return notify("ERROR MESSAGE", 'red');
	})
}, 500);

let hideFunc = popup("fetching messages...");
setTimeout(hideFunc, 2000);
