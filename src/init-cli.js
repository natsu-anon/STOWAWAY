const blessed = require('blessed');

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

class BlessedInit {
	constructor (banner,  title, process) {
		let screen = blessed.screen({
			smartcsr: true,
			autopadding: true,
			dockborders:true,
			fullunicode: true,
		});
		screen.title = title;
		this.content = [ `{cyan-fg}${banner}{/}` ];
		this.background = blessed.box({
			parent: screen,
			width: '100%',
			height: '100%',
			tags: true,
			content: this.content[0],
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
		})
		screen.key(['C-c'], () => {
			return process.exit(0);
		});
		screen.render();
		this.screen = screen;
	}

	destroy () {
		this.screen.destroy();
	}

	question (prompt, censor=false) {
		let textbox;
		if (censor) {
			textbox = blessed.textbox({
				parent: this.screen,
				left: 'center',
				top: 'center',
				tags: true,
				width: 80,
				height: 3,
				inputOnFocus: true,
				label: ` ${prompt} `,
				border: { type: 'line' },
				censor: true,
			});
		}
		else {
			textbox = blessed.textbox({
				parent: this.screen,
				left: 'center',
				top: 'center',
				tags: true,
				width: 80,
				height: 3,
				inputOnFocus: true,
				label: ` ${prompt} `,
				border: { type: 'line' },
			});
		}
		textbox.focus();
		textbox.setFront();
		this.screen.render();
		return new Promise((resolve, reject) => {
			textbox.once('submit', (val) => {
				textbox.destroy();
				this.screen.render();
				resolve(val);
			});
		});
	}

	select (setup) {
		let box = blessed.textbox({
			parent: this.screen,
			tags: true,
			height: '80%',
			width: 80,
			top: 'center',
			left: 'center',
			content: "loading...",
			padding: 1,
			/* NOT WORKING ???
			scrollable: true,
			alwaysScroll: true,
			draggable: true,
			scrollbar: {
				ch: '#',
				fg: 'black',
				bg: 'cyan',
			},
			*/
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

	cr (text) {
		if (this.content.length > 0) {
			this.content[this.content.length - 1] = text;
			this.background.setContent(this.content.join('\n'));
			this.screen.render();
		}
		else {
			log(text);
		}
	}

	cat (text) {
		if (this.content.length > 0) {
			this.content[this.content.length - 1] += text;
			this.background.setContent(this.content.join('\n'));
			this.screen.render();
		}
		else {
			log(text);
		}
	}

	spin (label) {
		this.popup.show();
		this.popup.setLabel(label);
		let timeout;
		const cycle = (i) => {
			this.popup.setContent(spinner[i++]);
			this.screen.render();
			timeout = setTimeout(() => {
				cycle(i % spinner.length);
			}, 40);
		}
		cycle(0);
		return () => {
			clearTimeout(timeout);
			this.popup.hide();
			this.screen.render();
		};
	}

	render () {
		this.screen.render();
	}
}

module.exports = BlessedInit;
