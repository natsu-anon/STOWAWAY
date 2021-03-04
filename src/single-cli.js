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

	constructor (title, notice, channelLabel, userTag) {
		this.screen = blessed.screen({
			smartcsr: true,
			autopadding: true,
			tabSize: 2,
			// debug: true,
			dockborders: true,
			fullunicode: true, // allows for meme double-wide characters
		});
		this.screen.title = title;
		this._notice = notice;
		this._channelLabel = ` ${channelLabel} `;
		this._inputLabel = ` Logged in as: ${userTag} `;
		blessed.box({
			parent: this.screen,
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
			tags:true,
			left: 62,
			top: 0,
			width: '100%-62',
			height: 1,
			align: 'right',
			content: this._notice,
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
			height:'100%-7',
			width: '100%',
			padding: 1,
			scrollable: true,
			alwaysScroll: true,
			scrollbar: {
				ch: '#',
				fg: 'black',
				bg: 'cyan',
			},
			label: this._channelLabel,
			border: {
				type: 'line',
			},
			content: "loading...",
		})
		this.inputBox = blessed.textbox({
			parent: this.screen,
			tags: true,
			tags: true,
			left: 0,
			top: '100%-6',
			label: this._inputLabel,
			width: '100%',
			height: 5,
			inputOnFocus: true,
			content: "your message here",
			border: {
				type: 'line',
			},
			padding : 1,
		});
		this.state = blessed.box({
			parent: this.screen,
			tags: true,
			// align: 'center',
			height: 1,
			width: '100%',
			top: '100%-1',
			content: 'state',
			fg: 'black',
			padding : {
				top: 0,
				right: 1,
				bottom: 0,
				left: 1,
			},
		});
		this.loadingBox = blessed.box({
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

	get channelScrollPerc () {
		return this.channelBox.getScrollPerc();
	}

	get channelHeight () {
		return this.channelBox.height - 4; // account for padding & label
	}

	get channelScrollHeight () {
		return this.channelBox.getScrollHeight();
	}

	set messages (text) {
		this.channelBox.setContent(text);
		this.screen.render();
	}

	set notice (text) {
		this._notice = text;
	}

	set channelLabel (text) {
		this._channelLabel = text;
	}

	set stateText (text) {
		this.state.setContent(text);
	}

	set stateBG (color) {
		this.state.style = { fg: 'black', bg: color };
	}

	submitInput () {
		const text = this.inputBox.getValue();
		this.inputBox.submit();
		this.inputBox.clearValue();
		return text;
	}

	/*
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
	*/

	focusInput () {
		this.inputBox.focus();
	}

	cancelInput () {
		this.inputBox.submit();
		this.inputBox.clearValue();
		this.screen.render();
	}

	loading (label) {
		this.loadingBox.show();
		this.loadingBox.setLabel(`{yellow-fg}${label}{/}`);
		this.loadingBox.setFront();
		let timeout;
		const cycle = (i) => {
			this.loadingBox.setContent(spinner[i++]);
			this.screen.render();
			timeout = setTimeout(() => {
				cycle(i % spinner.length);
			}, 40);
		}
		cycle(0);
		return () => {
			clearTimeout(timeout);
			this.loadingBox.hide();
			this.screen.render();
		};
	}

	question (text, yCallback, nCallback) {
		const box = blessed.box({
			parent: this.screen,
			tags: true,
			label: "{green-fg}[Y]{yellow-fg}es or {red-fg}[N]{yellow-fg}o?{/}",
			content: text,
			left: 'center',
			top: 'center',
			height: 5,
			width:30,
			padding:1,
			fg: 'yellow',
			border : {
				type: 'line',
				fg: 'yellow'
			},
		});
		cleanup = () => {
			this.screen.focusPop();
			box.destroy();
			this.screen.render();
		};
		box.key(['y'], () => {
			cleanup();
			yCallback();
		});
		box.key(['n'], () => {
			cleanup();
			nCallback();
		});
		box.setFront();
		this.screen.focusPush(box);
		this.screen.render();
	}

	popup (text, callback=undefined) {
		const box = blessed.box({
			parent: this.screen,
			tags: true,
			label: "{cyan-fg}[Enter]{yellow-fg} to continue{/}",
			content: text,
			left: 'center',
			top: 'center',
			height: 5,
			width:30,
			padding:1,
			fg: 'yellow',
			border : {
				type: 'line',
				fg: 'yellow'
			},
		});
		box.key(['enter'], () => {
			this.screen.focusPop();
			box.destroy();
			this.screen.render();
			if (callback != undefined) {
				callback();
			}
		});
		box.setFront();
		this.screen.focusPush(box);
		this.screen.render();
	}

	handshake (text) {
		this._notify(text, "cyan");
	}

	encrypted (text) {
		this._notify(text, "green");
	}

	error (text) {
		this._notify(text, "red");
	}

	warning (text) {
		this._notify(text, "yellow");
	}

	notify (text) {
		this._notify(text, 'white');
	}

	_notify (text, color) {
		this.notificationBox.setContent(text);
		this.notificationBox.style = {
			fg: 'black',
			bg: color,
		};
		this.screen.render();
		new Promise((resolve) => {
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
		.finally(() => {
			setTimeout(() => {
				this.notificationBox.setContent(this._notice);
				this.notificationBox.style = {
					fg: 'white',
					bg: 'black'
				};
				this.screen.render();
			}, 3000);
		})
	}

	scrollChannel (offset) {
		this.channelBox.scroll(offset);
		this.screen.render();
	}

	scrollChannelPerc (percentage) {
		this.channelBox.setScrollPerc(percentage);
		this.screen.render();
	}

	render () {
		this.screen.render();
	}

	destroy () {
		this.screen.destroy();
	}
}

function init (stowaway, cli) {
	cli.render();
}

module.exports = SingleCLI;
