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

class StowawayCLI {

	constructor (screen, title, name, tag, invite) {
		const LANDING =
`If there are no channels in the navigation box to your left you must add your bot to a server & make sure it has the proper permissions in order use said channels.
	- invitation link: {underline}${invite}{/underline}
	- see: {underline}https://github.com/natsu-anon/STOWAWAY#add-your-bot-to-a-server{/underline} for how to add your bot to a server.
	- pass '--channels' to STOWAWAY to list all channels availbale to your bot & any necessary permissions it lacks that it needs.

If you'd like to make a suggestion you can open up a new suggestion issue here: {underline}https://github.com/natsu-anon/STOWAWAY/issues/new/choose{/underline}

STOWAWAY is Free/Libre Open Source Software.  If you like it consider donating!
	- BTC Wallet: {underline}bc1q9c4cy76wpe84tcxftjw9k7wmshdndf32npkgg3{/underline}
	- ETH Wallet: {underline}0x6C5e469C3df5aB4A9c147E79c3a7a1356fa250A5{/underline}
	- DOGE Wallet: {underline}DS87ZXf2vXoUQmy3Wr5nNNNSiSGM55uGJs{/underline}
If you have diamond hands you can donate fiat currency via:
	- Ko-fi: {underline}https://ko-fi.com/natsusoft{/underline} (this uses paypal)
If you'd like to donate but can't use any of the above or want to donate an unlisted crypto create an issue at {underline}https://github.com/natsu-anon/STOWAWAY/issues/new/choose{/underline} and I'll get to it quick.

To learn more about the WTFPL that STOWAWAY is licensed under see: {underline}https://www.wtfpl.net{/underline}

Thanks for downloading & I hope you find this software useful
<3`;
		screen.title = title;
		screen.ignoreLocked = [];
		this.screen = screen;
		blessed.box({
			parent: this.screen,
			content: '[Ctrl-C] to close; [Ctrl-R] to revoke key; [Ctrl-A] for about; [Ctrl-K] for keybinds',
			left: 0,
			top: 0,
			width: 86,
			height: 1,
			padding : {
				right: 1,
				left: 1,
			},
		});
		this.notification = blessed.box({
			parent: this.screen,
			tags:true,
			right: 0,
			top: 0,
			width: '100%-86',
			height: 1,
			align: 'right',
			content: 'Notifications will appear here',
			padding : {
				right: 1,
				left: 1,
			},
		});
		this.navigation = blessed.box({
			parent: this.screen,
			tags: true,
			top: 1,
			left: 0,
			height: '100%-2',
			width: 40,
			padding: 1,
			scrollable: true,
			alwaysScroll: true,
			scrollbar: {
				ch: '@',
				track : {
					ch: '|',
				}
			},
			label: ` Logged in as {green-fg}{bold}${name}{/bold} (${tag}){/green-fg} `,
			border: {
				type: 'line',
			},
			content: 'Loading...',
		});
		this.messages = blessed.box({
			parent: this.screen,
			tags: true,
			left:40,
			top: 1,
			height:'100%-2',
			width: '100%-40',
			padding: 1,
			scrollable: true,
			alwaysScroll: true,
			scrollbar: {
				ch: '@',
				track : {
					ch: '|',
				}
			},
			label: ' Welcome! ',
			border: {
				type: 'line',
			},
			content: LANDING,
		});
		this.input = blessed.textbox({
			parent: this.screen,
			hidden: true,
			tags: true,
			left: 40,
			top: '100%-6',
			width: '100%-40',
			height: 5,
			inputOnFocus: true,
			border: {
				type: 'line',
			},
			padding : 1,
		});
		this.stateLine = blessed.box({
			parent: this.screen,
			bold: true,
			height: 1,
			width: '100%',
			top: '100%-1',
			content: 'HENLO',
			fg: 'black',
			bg: 'white',
			padding : {
				right: 1,
				left: 1,
			},
		});
		this.selector = blessed.box({ // used to select a channel to handshake & members
			parent: this.screen,
			tags: true,
			hidden: true,
			height: '80%',
			width: '50%',
			top: 'center',
			left: 'center',
			content: ' Loading... ',
			padding: 1,
			scrollable: true,
			alwaysScroll: true,
			scrollbar: {
				ch: '@',
				track: {
					ch: '|'
				}
			},
			border: {
				type: 'line',
				fg: 'green'
			}
		});
		this.popup = blessed.box({ // used for help & about
			parent: this.screen,
			hidden: true,
			tags: true,
			height: '80%',
			width: '50%', // lmao golden ratio
			label: ' FUG ',
			left: 'center',
			top: 'center',
			content: ':-D',
			scrollable: true,
			alwaysScroll: true,
			scrollbar: {
				ch: '@',
				track: {
					ch: '|'
				}
			},
			padding: 1,
			border: {
				type: 'line',
				fg: 'green'
			}
		});
	}

	set stateText (text) {
		this.stateLine.setText(text);
	}

	set stateColor (color) {
		this.stateLine.style.fg = 'white';
		this.stateLine.style.bg = color;
	}

	enableInput () {
		this.input.show();
		this.messages.height = '100%-7';
	}

	select (setup) {
		setup(this.selector);
		this.selector.show();
		this.selector.setFront();
	}

	setPopup (label, content) {
		this.popup.setLabel(` ${label} `);
		this.popup.setContent(content);
		this.popup.show();
		this.popup.setFront();
	}

	spin (label) {
		const spinBox = blessed.box({
			parent: this.screen,
			label: ` ${label} `,
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
		let timeout;
		const cycle = i => {
			spinBox.setContent(spinner[i++]);
			this.render();
			timeout = setTimeout(() => {
				cycle(i % spinner.length);
			}, 40);
		};
		this.render();
		cycle(0);
		return () => {
			clearTimeout(timeout);
			spinBox.destroy();
			this.render();
		};
	}

	notify (text) {
		this.visualBell(text);
	}

	visualBell(text) {
		this.notification.setContent(text);
		this.notification.style = { fg: 'black', bg: 'white' };
		this.screen.render();
		setTimeout(() => {
			this.notification.style = { fg: 'white', bg: 'black' };
			this.screen.render();
		}, 220);
	}

	warn (text) {
		const box = blessed.box({
			parent: this.screen,
			tags: true,
			label: ' {underline}WARNING{/underline} Press [Escape] to close ',
			content: text,
			top: 'center',
			left: 'center',
			width: '50%',
			height: '50%',
			padding: 1,
			border: {
				type: 'line',
				fg: 'yellow'
			}
		});
		this.screen.onceKey('escape', () => {
			box.destroy();
			this.screen.render();
		});
		this.screen.render();
		return box;
	}

	keyData (text) {
		const box = blessed.box({
			parent: this.screen,
			tags: true,
			label: ' Generated Key Data; Press [Escape] to close ',
			content: text,
			top: 'center',
			left: 'center',
			width: 80,
			height: 8,
			padding: 1,
			border: {
				type: 'line'
			}
		});
		this.screen.onceKey('escape', () => {
			box.destroy();
			this.screen.render();
		});
		this.screen.render();
		return box;
	}

	render () {
		this.screen.render();
	}

	destroy () {
		this.screen.destroy();
	}

}

module.exports = StowawayCLI;
