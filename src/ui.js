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

class BlessedCLI {

	constructor (blessed, userTag) {
		this.screen = blessed.screen({
			smartcsr: true,
			autopadding: true,
			debug: true,
			dockborders: true,
			fullunicode: true, // allows for meme double-wide characters
		});
		screen.title = 'ＳＴＯＷＡＷＡＹ v0.2.0';
		this._loginNotice = `logged in as ${userTag}`;
		this._navigationLabel = 'SERVERS/DIRECT MESSAGES';
		this._channelLabel = 'SERVER_NAME #CHANNEL_NAME';
		this._inputLabel = '[E] to write an encrypted message';
		blessed.box({ parent: screen,
			tags: true,
			content: 'DO NOT SHARE `app.token` NOR `key.spk`',
			left: 0,
			top: 0,
			width: 40,
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
			parent: screen,
			left: 40,
			top: 0,
			width: '100%-40',
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
		this.navigationBox = blessed.box({
			parent: screen,
			tags: true,
			left: 0,
			top: 1,
			width: 40,
			tags: true,
			height: '100%-1',
			label: this._navigationLabel,
			content: "holup",
			scrollable: true,
			scrollbar: {
				bg: 'yellow',
			},
			border: {
				type: 'line',
			},
			padding: 1,
		})
		this.channelBox = blessed.box({
			parent: screen,
			tags: true,
			left:40,
			top: 1,
			height:'100%-4',
			width: '100%-40',
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
			content: "holup...",
		})
		this.inputBox = blessed.textarea({
			parent: screen,
			tags: true,
			tags: true,
			left: 40,
			top: '100%-3',
			label: this._inputLabel,
			width: '100%-40',
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
			parent: screen,
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
	}

	set channelContent (text) {
		channelBox.setContent(text);
		screen.render();
	}

	set channelLabel (text) {
		this._channelLabel = text;
		channelBox.setLabel(text);
		screen.render();
	}

	set navigationLabel (text) {
		this._naviationLabel = text;
		navigationBox.setLabel(text);
		screen.render();
	}

	set navigationContent (text) {
		navigationBox.setContent(text);
		screen.render();
	}

	submitInput () {
		const text = this.inputBox.getValue();
		this.inputBox.submit();
		this.inputBox.clearValue();
		return text;
	}

	cancelInput () {
		this.inputBox.submit();
	}

	unfocusInput () {
		this.inputBox.setLabel(_this.inputLabel);
		this.inputBox.border = {
			type: 'line',
		};
		screen.render();
	}

	focusInput () {
		if (!this.inputBox.focused) {
			this.inputBox.setLabel(`{green-fg}[Enter] to send the message, [Escape] to stop writing{/}`);
			this.inputBox.border = {
				type: 'line',
				fg: 'green',
			};
			unfocusNaviation();
			unfocusChannel();
			this.inputBox.focus();
			screen.render();
		}
	}

	focusNavigation () {
		this.navigationBox.setLabel(`{green-fg}${this._navigationBox}{/}`);
		this.navigationBox.border = {
			type: 'line',
			fg: 'green',
		};
		unfocusChannel();
		if (!this.inputBox.focused) {
			unfocusInput();
		}
		this.screen.render();
	}

	focusChannel () {
		this.channelBox.setLabel(`{green-fg}${this._channelLabel}{/}`);
		this.channelBox.border = {
			type: 'line',
			fg: 'green',
		};
		unfocusNavigation();
		if (!this.inputBox.focused) {
			unfocusInput();
		}
		this.screen.render();
	}

	unfocusInput () {
	}

	unfocusChannel () {
	}

	unfocusNavigation () {
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
					this..render();
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

	render () {
		this.screen.render();
	}
}





function init (blessedCLI) {
	// all the hookups
	blessedCLI.render();
}

module.exports = {
	CLI : (blessed, userTag) => {
		return init(new BlessedCLI(blessed, userTag));
	},
};
