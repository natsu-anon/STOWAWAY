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

const LANDING = `This message will vanish when you begin reading a channel.

If there are no channels in the navigation box to your right you must add your bot to a server & make sure it has the proper permissionsin order use said channels.
	- see: {underline}https://github.com/natsu-anon/STOWAWAY#add-your-bot-to-a-server{/underline} for how to add your bot to a server.
	- pass '--channels' to STOWAWAY to list all channels availbale to your bot & any necessary permissions it lacks that it needs.

STOWAWAY is Free/Libre Open Source Software.  If you like it consider donating!
	- BTC Wallet: {underline}bc1q9c4cy76wpe84tcxftjw9k7wmshdndf32npkgg3{/underline}
	- ETH Wallet: {underline}0x6C5e469C3df5aB4A9c147E79c3a7a1356fa250A5{/underline}
	- DOGE Wallet: {underline}DS87ZXf2vXoUQmy3Wr5nNNNSiSGM55uGJs{/underline}
If you have diamond hands you can donate fiat currency via:
	- Ko-fi: {underline}https://ko-fi.com/natsusoft{/underline} (this uses paypal)
If you'd like to donate but can't use any of the above or want to donate an unlisted crypto create an issue at {underline}https://github.com/natsu-anon/STOWAWAY/issues{/underline} and I'll get to it quick.

To learn more about the WTFPL that STOWAWAY is licensed under see: {underline}https://www.wtfpl.net{/underline}

Thanks for downloading & I hope you find this software useful
<3`;

class StowawayCLI {

	constructor (title, userTag, navigationContent) {
		this.screen = blessed.screen({
			smartcsr: true,
			autopadding: true,
			tabSize: 2,
			dockborders: true,
			fullunicode: true, // allows for meme double-wide characters
		});
		this.screen.title = title;
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
				ch: '#',
				fg: 'black',
				bg: 'cyan',
			},
			label: ` Logged in as ${userTag} `,
			border: {
				type: 'line',
			},
			content: navigationContent,
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
				fg: 'black',
				bg: 'cyan',
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
			label: this._inputLabel,
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
			width: 80,
			top: 'center',
			left: 'center',
			content: ' Loading... ',
			padding: 1,
			border: { type: 'line' }

		});
		this.selector.display = (index, content) => {
			if (this.selectorHeight <= 1) {
				this.selector.setContent(content[index]);
			}
			else {
				const halfHeight = Math.floor(this.selectorHeight / 2);
				const contentHeight = content.length;
				if (contentHeight > this.selectorHeight) {
					if (index <= halfHeight) {
						this.selector.setContent(content.slice(0, this.selectorHeight).join('\n'));
					}
					else if (index >= contentHeight - halfHeight) {
						this.selector.setContent(content.slice(contentHeight - this.selectorHeight, contentHeight).join('\n'));
					}
					else {
						this.selector.setContent(content.slice(index - halfHeight, index + halfHeight).join('\n'));
					}
				}
				else {
					this.selector.setContent(content.join('\n'));
				}
			}
		};
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
				fg: 'black',
				bg: 'cyan',
			},
			padding: 1,
			border: {
				type: 'line'
			}
		});
		this.revoke = blessed.textbox({
			parent: this.screen,
			tags: true,
			inputOnFocus: true,
			hidden: true,
			width: 80, // width changes based on label
			height: 5,
			label: '{red-bg}{black-fg} INITIALIZING... {/}',
			left: 'center',
			top: 'center',
			bg: 'red',
			fg: 'black',
			padding: 1,
			border: {
				type: 'line',
				bg: 'red',
				fg: 'black'
			}
		});
	}

	set revokeLabel (label) {
		this.revoke.setLabel(`{red-bg}{black-fg} ${label} {/}`);
		this.revoke.width = label.length + 8;
	}

	set stateText (text) {
		this.stateLine.setText(text);
	}

	set stateColor (color) {
		this.stateLine.style = { fg: 'white', bg: color };
	}

	get selectorHeight () {
		return this.selector.height - 4;
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
				fg: 'yellow',
			},
			fg: 'yellow',
		});
		let timeout;
		const cycle = i => {
			spinBox.setContent(spinner[i++]);
			this.render();
			timeout = setTimeout(() => {
				cycle(i % spinner.length);
			}, 40);
		};
		cycle(0);
		return () => {
			clearTimeout(timeout);
			spinBox.destroy();
			this.render();
		};
	}

	render () {
		this.screen.render();
	}

	destroy () {
		this.screen.destroy();
	}
}

module.exports = StowawayCLI;
