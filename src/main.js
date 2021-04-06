const process = require('process');

const phrase = require('./nato-phrase.js');
const versionCheck = require('./version-check.js');
const initialize = require('./initialization.js');
const StowawayCLI = require('./stowaway-cli.js');
const { Permissible } = require('./stowaway.js');
const { NavigateColor, ReadColor, WriteColor, MemberColor } = require('./state_machine/state-colors.js');
const FSMBuilder = require('./state_machine/fsm-builder.js');
const { ChannelsMediator, HandshakedMediator } = require('./mediators.js');
const { ChannelsModel, HandshakedModel, MessagesModel } = require('./models.js');

// NOTE update url to use main branch
const VERSION_URL = 'https://raw.githubusercontent.com/natsu-anon/STOWAWAY/development/version.json';
const SCREEN_TITLE = 'ＳＴＯＷＡＷＡＹ';

function main (VERSION, BANNER, DATABASE, API_TOKEN, PRIVATE_KEY, REVOCATION_CERTIFICATE) {
	let cli;
	versionCheck(VERSION_URL, VERSION)
	.then(result => {
		return initialize(BANNER, SCREEN_TITLE, DATABASE, API_TOKEN, PRIVATE_KEY, VERSION, REVOCATION_CERTIFICATE, result);
	})
	.then(async ({ stowaway, client, key, db }) => {
		const ABOUT = require('./about.js')(BANNER);
		let allowTab = false; // block tabbing into read state until navigated away from the landing page & to a proper channel
		stowaway.launch(client, key);
		// both mediators are ok
		const hMediator = new HandshakedMediator(await (new HandshakedModel()).initialize(stowaway, client, db));
		const cMediator = new ChannelsMediator(await (new ChannelsModel()).initialize(client, db));
		const cMediatorBox = (box, text) => { // this allows the display box to be naturally scrollable
			if (cMediator.length > 0) {
				box.display(cMediator.index, cMediator.content);
			}
			else {
				box.setContent(text);
			}
		};
		cli = new StowawayCLI(SCREEN_TITLE, client.user.tag, hMediator.text);

		//  UPDATE LISTENING TO RENDER //

		hMediator.on('update', text => {
			cli.navigationBox.setContent(text);
			cli.render();
		});
		// const mModel = new MessagesModel(stowaway);
		// mModel.on('update',text => {
		// 	cli.messages = text;
		// 	if (cli.channelScrollPerc === 100 || cli.channelHeight >= cli.channelScrollHeight) {
		// 		cli.scrollChannelPerc(100);
		// 	}
		// 	cli.render();
		// });

		//  FSM BUILDER  //

		const fsm = new FSMBuilder()
			.navigate(() => {
				cli.stateText = `NAVIGATE | ${hMediator.length} handshaked channels`;
				cli.stateColor = NavigateColor;
				cli.render();
			})
			.handshake(prevState => {
				cli.stateText = `${prevState.name} | HANDSHAKE | ${cMediator.length} text channels`;
				cli.stateColor = prevState.color;
				cli.select(box => {
					box.label = ' Select an available server to handshake ';
					cMediatorBox(box, cMediator.text);
					box.on('resize', () => {
						cMediatorBox(box, cMediator.text);
						cli.render();
					});
					cMediator.on('update', text => {
						cMediatorBox(box, text);
						cli.render();
					});
				});
				cli.render();
			},
			() => {
				cMediator.removeAllListeners('update');
				cli.selector.removeAllListeners('resize');
				cli.selector.hide();
			})
			.read(() => {
				cli.stateText = 'READ | initializing...'; // eventually specify session as well
				cli.stateColor = ReadColor;
				cli.render();
			})
			.write(() => {
				cli.stateText = 'WRITE | specify if public or private'; // eventually sepcify session as well
				cli.stateBG = WriteColor;
				cli.render();
			})
			.member(() => {
				cli.stateText = 'MEMBERS | initializing...';
				cli.stateBG = MemberColor;
				cli.render();
			})
			.revoke(prevState => {
				cli.stateText = `${prevState.name} | REVOKE | WARNING: revoking a key is irreversible!`;
				cli.stateBG = prevState.color;
				cli.revoke.show();
				cli.render();
			}, () => {
				cli.revoke.hide();
			})
			.about(prevState => {
				cli.stateText = `${prevState.name} | ABOUT | STOWAWAY version: ${VERSION}`;
				cli.setPopup('About STOWAWAY; [Escape] to return', ABOUT);
				cli.stateBG = prevState.color;
				cli.render();
			}, () => {
				cli.popup.hide();
			})
			.keybinds(prevState => {
				cli.stateText = `${prevState.name} | KEYBINDS`;
				cli.stateBG = prevState.color;
				cli.setPopup(`Keybinds for ${prevState.name} state controls; [Escape] to return`, prevState.help);
				cli.render();
			}, () => {
				cli.popup.hide();
			})
			.build();

		// fsm.handshake(fsm.current);

		//  FSM EVENT LISTENING  //

		/*
		fsm.on('read channel', async enterFlag => {
			if (enterFlag) {
				const id = hMediator.channelId();
				if (id != null) {
					const channel = await client.channels.fetch(id);
					allowTab = true;
					cli.channelLabel = ` #${channel.name} ${channel.topic != null ? channel.topic : ''}`;
					mModel.listen(id);
				}
			}
			if (allowTab) {
				fsm.read(); // this calls cli.render()
			}
		});
		fsm.on('navigate channels', hMediator.scrollChannels);
		fsm.on('navigate servers', hMediator.scrollServers);
		fsm.on('navigation set favorite', number => {
			const id = hMediator.channelId();
			if (id != null) {
				hMediator.setFavorite(number, id);
			}
		});
		fsm.on('navigation clear favorite', () => {
			const id = hMediator.channelId();
			if (id != null) {
				hMediator.clearFavorite(id);
			}
		});
		fsm.on('perform handshake', () => {
			const data = cMediator.channelData();
			if (data.valid) {
				const stop = cli.loading('handshaking new channel');
				client.channels.fetch(data.id)
				.then(channel => stowaway.loadChannel(channel))
				.then(() => {
					mModel.listen(data.id);
					stop();
					fsm.navigate();
				})
				.catch(err => { throw err; });
			}
		});
		// etc.
		*/
		fsm.on('quit', () => {
			cli.destroy();
			client.destroy();
			db.persistence.compactDatafile();
			return process.exit(0);
		});

		//  STOWAWAY EVENT LISTENING  //

		fsm.on('handshake channels', next => { cMediator.scrollChannels(next); });
		fsm.on('handshake servers', next => { cMediator.scrollServers(next); });

		//  KEYBINDING  //

		// these work regardless of state
		cli.screen.onceKey('C-c', () => { fsm.ctrlC(); });
		cli.input.onceKey('C-c', () => { fsm.ctrlC(); });
		cli.screen.key('C-r', () => { fsm.ctrlR(); });
		cli.input.key('C-r', () => { fsm.ctrlR(); });
		cli.screen.key('C-a', () => { fsm.ctrlA(); });
		cli.input.key('C-a', () => { fsm.ctrlA(); });
		cli.screen.key('C-k', () => { fsm.ctrlK(); });
		cli.input.key('C-k', () => { fsm.ctrlK(); });
		cli.screen.key('escape', () => { fsm.escape(); });
		cli.input.key('escape', () => { fsm.escape(); });
		// these work in all states but input
		cli.screen.key(['e', 'S-e'], () => { fsm.e(); });
		cli.screen.key(['`', '~'], () => { fsm.backtick(); });
		// state specific
		cli.screen.key(['w', 'S-w'], () => { fsm.w(); });
		cli.screen.key(['s', 'S-s'], () => { fsm.s(); });
		cli.screen.key(['a', 'S-a'], () => { fsm.a(); });
		cli.screen.key(['d', 'S-d'], () => { fsm.d(); });
		// cli.screen.key('linefeed', () => { fsm.ctrlEnter(); }); // linefeed is ctrl-enter
		// cli.screen.key(['backspace', 'delete' ], () => { fsm.backspace(); });
		// const model = new SingleChannel();
		// cli = new SingleCLI(SCREEN_TITLE, '{bold}[Ctrl-C] to quit{/bold}', `${channel.guild.name} {green-fg}#${channel.name}{/}`, client.user.tag);
		// stowaway.on('message', model.message);
		// stowaway.on('error', err => { cli.error(err); });
		// stowaway.on('timestamp', (ts, id) => { model.timestamp(ts, id); });
		// stowaway.on('failed decrypt', model.decryptionFailure);
		// stowaway.on('handshake', model.handshake);
		// stowaway.on('notify', message => { cli.notify(message); });
		// stowaway.on('debug', message => { cli.warning(`DEBUG: ${message}`); });
		// stowaway.on('channel delete', () => { cli.error(`${channel.name} deleted!`); });
		// stowaway.on('channel update', ch => {
		// 	cli.notify('channel updated!');
		// 	cli.channelLabel = `${ch.guild.name} {green-fg}#${ch.name}{/}`;
		// 	cli.render();
		// });
		// stowaway.on('bad handshake', user => {
		// 	cli.warning(`BAD HANDSHAKE from ${user.tag}`);
		// });
		// stowaway.on('handshake', (ts, date, user) => {
		// 	cli.handshake(`HANDSHAKE from ${user.tag}`);
		// });
		// model.on('update', () => {
		// 	const flag = cli.channelScrollPerc === 100 || cli.channelHeight >= cli.channelScrollHeight;
		// 	cli.messages = model.text;
		// 	if (flag) {
		// 		cli.scrollChannelPerc(100);
		// 	}
		// 	else {
		// 		cli.render();
		// 	}
		// });
		// stowaway.launch(client, key);
		// // stowaway.launch(client);
		// stowaway.on('message', (ts, date, author, content) => {
		// 	cli.encrypted(`new message from ${author.tag}`);
		// });
		// cli.messages = model.text;
		// const fsm = new FSMBuilder()
		// .enterRead(() => {
		// 	cli.stateBG = 'magenta';
		// 	cli.stateText = 'READING -- [SPACE] begin writing; [W] scroll up/fetch older messages; [S] scroll down/fetch newer messages; [1] to jump to bottom';
		// 	cli.render();
		// })
		// .enterWrite(() => {
		// 	if (!cli.inputBox.focused) {
		// 		cli.screen.focusPush(cli.inputBox);
		// 		cli.stateBG = 'green';
		// 		cli.stateText = 'WRITING -- [ESCAPE] to stop writing; [ENTER] to send';
		// 		cli.render();
		// 	}
		// })
		// .exitWrite(() => {
		// 	if (cli.inputBox.focused) {
		// 		cli.screen.focusPop();
		// 		cli.render();
		// 	}
		// })
		// .build();
		// fsm.on('quit', () => {
		// 	client.destroy();
		// 	db.persistence.compactDatafile();
		// 	return process.exit(0);
		// });
		// cli.screen.key(['space'], () => {
		// 	fsm.onSpace();
		// });
		// cli.screen.key(['C-c'], () => {
		// 	fsm.onCtrlC();
		// });
		// cli.screen.key(['enter'], () => {
		// 	fsm.onEnter();
		// });
		// cli.screen.key(['escape'], () => {
		// 	fsm.onEsc();
		// });
		// cli.screen.key(['w'], () => {
		// 	fsm.onW();
		// });
		// cli.screen.key(['s'], () => {
		// 	fsm.onS();
		// });
		// cli.inputBox.key(['C-c'], () => {
		// 	fsm.onCtrlC();
		// });
		// cli.inputBox.key(['enter'], () => {
		// 	fsm.onEnter();
		// });
		// cli.inputBox.key(['escape'], () => {
		// 	fsm.onEsc();
		// });
		// cli.screen.key(['1'], () => {
		// 	cli.scrollChannelPerc(100);
		// });
		// fsm.on('send input', () => {
		// 	stowaway.encrypt(cli.submitInput());
		// });
		// fsm.on('clear input', () => {
		// 	cli.cancelInput();
		// });
		// const fetchOlder = function () {
		// 	stowaway.fetchOlder(model.oldest)
		// 	.then(() => { cli.notify('fetched older messages!'); });
		// };
		// const fetchNewer = function () {
		// 	stowaway.fetchNewer(model.newest)
		// 	.then(() => { cli.notify('fetched newer messages!'); });
		// };
		// fsm.on('scroll', offset => {
		// 	if (cli.channelHeight >= cli.channelScrollHeight) {
		// 		if (offset > 0) {
		// 			fetchNewer();
		// 		}
		// 		else if (offset < 0) {
		// 			fetchOlder();
		// 		}
		// 	}
		// 	else {
		// 		if (cli.channelScrollPerc === 0 && offset < 0) {
		// 			fetchOlder();
		// 		}
		// 		else if (cli.channelScrollPerc === 100 && offset > 0) {
		// 			fetchNewer();
		// 		}
		// 		else {
		// 			cli.scrollChannel(offset);
		// 		}
		// 	}
		// });
	})
	.catch(err => {
		if (cli != null) {
			cli.destroy();
		}
		if (err != null) {
			console.error(err);
		}
		console.log('\nPass --help to see usage information');
		console.log('Press [Ctrl-C] to quit');
	});
}

module.exports = main;
