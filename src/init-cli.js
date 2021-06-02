const blessed = require('blessed');

const spinner = [
	'[@               ]',
	'[ @              ]',
	'[  @             ]',
	'[   @            ]',
	'[    @           ]',
	'[     @          ]',
	'[      @         ]',
	'[       @        ]',
	'[        @       ]',
	'[         @      ]',
	'[          @     ]',
	'[           @    ]',
	'[            @   ]',
	'[             @  ]',
	'[              @ ]',
	'[               @]',
	'[              @ ]',
	'[             @  ]',
	'[            @   ]',
	'[           @    ]',
	'[          @     ]',
	'[         @      ]',
	'[        @       ]',
	'[       @        ]',
	'[      @         ]',
	'[     @          ]',
	'[    @           ]',
	'[   @            ]',
	'[  @             ]',
	'[ @              ]',
];

class BlessedInit {
	constructor (banner, title) {
		const screen = blessed.screen({
			smartcsr: true,
			autopadding: true,
			tabSize: 2,
			dockborders:true,
			fullunicode: true,
			ignoreLocked : [ 'C-c', 'C-r', 'C-k', 'C-a', 'escape' ],
		});
		screen.title = title;
		this.content = [ banner ];
		this.background = blessed.box({
			parent: screen,
			width: '100%',
			height: '100%-1',
			tags: true,
			content: this.content[0],
		});
		blessed.box({
			parent: screen,
			width: '100%',
			height: 1,
			tags: true,
			top: '100%-1',
			fg: 'black',
			bg: 'white',
			content: ' Press [Ctrl-C] to quit'
		});
		this.popup = blessed.box({
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
			},
		});
		screen.render();
		this.screen = screen;
	}

	decouple () {
		this.screen.children.forEach(child => {
			child.destroy();
		});
	}

	destroy () {
		this.screen.destroy();
	}

	question (prompt, censor=false) {
		const textbox = blessed.textbox({
			parent: this.screen,
			left: 'center',
			top: 'center',
			tags: true,
			width: 80,
			height: 5,
			padding: 1,
			inputOnFocus: true,
			label: ` ${prompt} `,
			border: { type: 'line' },
			censor: censor,
		});
		textbox.focus();
		textbox.setFront();
		this.screen.render();
		return {
			textbox,
			promise: new Promise(resolve => {
				textbox.once('submit', value => {
					textbox.destroy();
					this.screen.render();
					resolve(value);
				});
			})
		};
	}

	select (setup) {
		const box = blessed.textbox({
			parent: this.screen,
			tags: true,
			height: '80%',
			width: 80,
			top: 'center',
			left: 'center',
			content: 'loading...',
			padding: 1,
			border: {
				type: 'line'
			}
		});
		Object.defineProperty(box, 'actualHeight', {
			get: function () { return this.height - 4; }
		});
		const selected = setup(box);
		box.setFront();
		box.focus();
		this.screen.render();
		selected.finally(() => {
			box.destroy();
			this.screen.render();
		});
		return selected;
	}

	log (text) {
		this.content.push(text);
		this.background.setContent(this.content.join('\n'));
		this.screen.render();
	}

	pauseLog (text) {
		this.content.push(text);
		this.content.push('Press [Enter] to continue...');
		this.background.setContent(this.content.join('\n'));
		this.screen.render();
		return new Promise(resolve => {
			this.screen.onceKey(['enter'], () => {
				resolve();
			});
		});
	}

	cr (text) {
		if (this.content.length > 0) {
			this.content[this.content.length - 1] = text;
			this.background.setContent(this.content.join('\n'));
			this.screen.render();
		}
		else {
			this.log(text);
		}
	}

	cat (text) {
		if (this.content.length > 0) {
			this.content[this.content.length - 1] += text;
			this.background.setContent(this.content.join('\n'));
			this.screen.render();
		}
		else {
			this.log(text);
		}
	}

	spin (label) {
		this.popup.show();
		this.popup.setLabel(label);
		let timeout;
		const cycle = i => {
			this.popup.setContent(spinner[i++]);
			this.screen.render();
			timeout = setTimeout(() => {
				cycle(i % spinner.length);
			}, 40);
		};
		cycle(0);
		return () => {
			clearTimeout(timeout);
			this.popup.hide();
			this.screen.render();
		};
	}

	notify (text) {
		const chars = text.split('\n').map(x => x.length);
		let max = 0;
		for (let i = 0; i < chars.length; i++) {
			if (chars[i] > max) {
				max = chars[i];
			}
		}
		const box = blessed.box({
			parent: this.screen,
			left: 'center',
			top: 'center',
			tags: true,
			width: parseInt(max) + 4,
			height: chars.length + 4,
			valign: 'middle',
			padding: 1,
			label: ' Press [Enter] to continue ',
			content: text,
			border: { type: 'line' },
		});
		box.focus();
		this.screen.render();
		return new Promise(resolve => {
			box.key('enter', () => {
				box.destroy();
				this.screen.render();
				resolve();
			});
		});
	}

	toggleQuestion (prompt0, prompt1, toggleKey) {
		let flag = true;
		const toggleBox = prompt => {
			const length = this.background.strWidth(prompt.text) + 6;
			const box = blessed.textbox({
				parent: this.screen,
				left: 'center',
				top: 'center',
				tags: true,
				width: (length > 80 ? length : 80),
				height: 5,
				padding: 1,
				inputOnFocus: true,
				label: ` ${prompt.text} `,
				border: { type: 'line' },
				censor: prompt.censor == null ? false : prompt.censor,
			});
			box.focus();
			this.screen.render();
			box.onceKey(toggleKey, () => {
				box.destroy();
				flag ? toggleBox(prompt1) : toggleBox(prompt0);
				flag = !flag;
			});
			box.once('submit', value => {
				box.destroy();
				this.screen.render();
				prompt.callback(value);
			});
		};
		toggleBox(prompt0);
	}

	render () {
		this.screen.render();
	}
}

module.exports = BlessedInit;
