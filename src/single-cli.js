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

class SingleCLI {

	constructor (userTag, channelName) {
		this.screen = blessed.screen({
			smartcsr: true,
			autopadding: true,
			// debug: true,
			dockborders: true,
			fullunicode: true, // allows for meme double-wide characters
		});
		this.screen.title = 'ＳＴＯＷＡＷＡＹ v0.2.0';
		this._loginNotice = `Logged in as ${userTag}`;
		this._channelLabel = `#${channelName}`;
		this._inputLabel = '[Space] to write an encrypted message';
		blessed.box({ parent: this.screen,
			tags: true,
			content: 'DO NOT SHARE YOUR APP TOKEN.  DO NOT SHARE YOUR PRIVATE KEY.',
			left: 0,
			top: 0,
			width: 62,
			height: 1,
			fg: 'yellow',
			padding : {
				top: 0,
				right: 1,
				bottom: 0,
				left: 1,
			},
		});
		this.notificationBox = blessed.box({
			parent: this.screen,
			left: 62,
			top: 0,
			width: '100%-62',
			height: 1,
			align: 'right',
			content: this._loginNotice,
			padding : {
				top: 0,
				right: 1,
				bottom: 0,
				left: 1,
			},
		});
		this.channelBox = blessed.box({
			parent: this.screen,
			tags: true,
			left:0,
			top: 1,
			height:'100%-4',
			width: '100%',
			padding: 1,
			scrollable: true,
			scrollbar: {
				bg: 'yellow',
			},
			label: this._channelLabel,
			border: {
				type: 'line',
				fg: 'green',
			},
			content: "loading...",
		})
		this.inputBox = blessed.textarea({
			parent: this.screen,
			tags: true,
			tags: true,
			left: 0,
			top: '100%-3',
			label: this._inputLabel,
			width: '100%',
			height: 3,
			inputOnFocus: true,
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
		this.popupBox = blessed.box({
			parent: this.screen,
			tags: true,
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
				fg: 'yellow',
			},
			fg: 'yellow',
		})
		this.screen.render();
	}

	set messages (text) {
		this.channelBox.setContent(text);
		this.screen.render();
	}

	set loginNotice (text) {
		this._loginNotice = text;
		this.screen.render();
	}

	set channelLabel (text) {
		this._channelLabel = text;
		this.screen.render();
	}

	submitInput () {
		const text = this.inputBox.getValue();
		this.inputBox.submit();
		this.inputBox.clearValue();
		return text;
	}

	pauseInput () {
		this.inputBox.submit();
	}

	cancelInput () {
		this.inputBox.submit();
		this.inputBox.clearValue();
	}

	focusChannel () {
		this.channelBox.setLabel(`{green-fg}${this._channelLabel}{/}`);
		this.channelBox.border = {
			type: 'line',
			fg: 'green',
		};
		unfocusInput();
		this.screen.render();
	}

	focusInput () {
		if (!this.inputBox.focused) {
			this.inputBox.setLabel(`{green-fg}[Enter] to send the message, [Escape] to stop writing{/}`);
			this.inputBox.border = {
				type: 'line',
				fg: 'green',
			};
			unfocusChannel();
			this.inputBox.focus();
			this.screen.render();
		}
	}

	unfocusChannel () {
		this.channelBox.setLabel(this._channelLabel);
		this.channelBox.border = { type: 'line' };
	}

	unfocusInput () {
		this.inputBox.setLabel(_this.inputLabel);
		this.inputBox.border = {
			type: 'line',
		};
	}

	popup (label) {
		this.popupBox.show();
		this.popupBox.setLabel(`{yellow-fg}${label}{/}`);
		let timeout;
		const cycle = function (i) {
			this.popupBox.setContent(spinner[i++]);
			this.screen.render();
			timeout = setTimeout(() => {
				cycle(i % spinner.length);
			}, 40);
		}
		cycle(0);
		return () => {
			clearTimeout(timeout);
			this.popupBox.hide();
			this.screen.render();
		};
	}

	notify (text, type) {
		if (type === "handshake") {
			_notify(text, 'cyan')
		}
		else if (type === 'encrypted') {
			_notify(text, 'green');
		}
		else if (type === 'error') {
			_notify(text, 'red');
		}
		else {
			_notify(text, 'yellow');
		}
	}

	_notify (text, color) {
		this.notificationBox.setContent(text);
		this.notificationBox.style = {
			fg: 'black',
			bg: color,
		};
		this.screen.render();
		return new Promise((resolve) => {
			setTimeout(() => {
				this.notificationBox.style = {
					fg: color,
					bg: 'black',
				};
				this.screen.render();
				resolve();
			}, 100);
		})
		.then(() => {
			return new Promise((resolve) => {
				setTimeout(() => {
					this.notificationBox.style = {
						fg: 'black',
						bg: color,
					};
					this.screen.render();
					resolve();
				}, 100);
			})
		})
		.then(() => {
			return new Promise((resolve) => {
				setTimeout(() => {
					this.notificationBox.style = {
						fg: color,
						bg: 'black',
					};
					this.render();
					resolve();
				}, 100);
			})
		})
		.then(() => {
			return new Promise((resolve) => {
				setTimeout(() => {
					this.notificationBox.style = {
						fg: 'black',
						bg: color,
					};
					this.screen.render();
					resolve();
				}, 100);
			})
		})
		.then(() => {
			return new Promise((resolve) => {
				setTimeout(() => {
					notificationBox.hide();
					this.screen.render();
					resolve();
				}, 3000);
			})
		})
		.finally(() => {
			this.notificationBox.setContent(this._loginNotice);
			this.notificationBox.style = {
				fg: 'white',
				bg: 'black'
			};
			screen.render();
		});
	}

	scrollChannel (offset) {
		this.channelBox.scroll(offset);
	}

	render () {
		this.screen.render();
	}
}

function init (stowaway, cli) {
	cli.render();
}

module.exports = SingleCLI;
