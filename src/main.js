const process = require('process');

const phrase = require('./nato-phrase.js');
const versionCheck = require('./version-check.js');
const initialize = require('./initialization.js');
const StowawayCLI = require('./stowaway-cli.js');
const { Permissions, Messager } = require('./stowaway.js');
const Revoker = require('./revoker.js');
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

		//   COOMPOSITING  //

		const messager = new Messager(stowaway);
		const revoker = new Revoker(stowaway, client, PRIVATE_KEY, REVOCATION_CERTIFICATE).setKey(key);
		const hMediator = new HandshakedMediator(await (new HandshakedModel()).initialize(stowaway, client, db));
		const cMediator = new ChannelsMediator(await (new ChannelsModel()).initialize(stowaway, client, db));

		//  COMMAND LINE INTERFACE  //

		cli = new StowawayCLI(SCREEN_TITLE, client.user.tag);
		// cli.screen.on('resize', () => { cli.render(); });

		//  UPDATE LISTENING TO RENDER //

		hMediator.on('update', text => {
			cli.navigation.setContent(text);
			cli.navigation.setScrollPerc(hMediator.percentage);
			cli.render();
		});
		hMediator.on('resize', () => {
			cli.navigation.setScrollPerc(hMediator.percentage);
			cli.render();
		});
		cli.navigation.setContent(hMediator.text);
		cli.navigation.setScrollPerc(hMediator.percentage);
		const messages = new MessagesModel(stowaway);
		messages.on('update',text => {
			cli.messages.setContent(text);
			if (cli.channelScrollPerc === 100 || cli.channelHeight >= cli.channelScrollHeight) {
				cli.scrollChannelPerc(100);
			}
			cli.render();
		});


		//  FSM BUILDER  //

		const fsm = new FSMBuilder()
			.navigate(() => {
				cli.stateText = `NAVIGATE | ${hMediator.numChannels} handshaked channels`;
				cli.stateColor = NavigateColor;
				cli.render();
			})
			.handshake(prevState => {
				cli.stateText = `HANDSHAKE | from: ${prevState.name} | ${cMediator.numChannels} text channels`;
				cli.stateColor = prevState.color;
				cli.select(box => {
					box.setLabel(' Select an available server to handshake; [Escape] to return ');
					box.setContent(cMediator.text);
					box.setScrollPerc(cMediator.percentage);
					box.on('resize', () => {
						box.setScrollPerc(cMediator.percentage);
						cli.render();
					});
					cMediator.on('update', text => {
						box.setContent(text);
						box.setScrollPerc(cMediator.percentage);
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
			.read(({ guildName, channelName, nickname, topic, numStowaways, statelineOnly }) => {
				if (!statelineOnly) {
					if (topic != null) {
						cli.messages.setLabel(` #${channelName} | ${topic}`);
					}
					else {
						cli.messages.setLabel(` #${channelName} `);
					}
				}
				let temp = `READ | ${guildName}`; // eventually specify session as well
				if (nickname != null) {
					temp += ` | nickname: ${nickname}`;
				}
				if (numStowaways === 1) {
					temp += ' | 1 fellow stowaway';
				}
				else {
					temp += ` | ${numStowaways} fellow stowaways`;
				}
				cli.stateText = temp;
				cli.stateColor = ReadColor;
				cli.render();
			})
			.write(publicFlag => {
				cli.input.focus();
				cli.stateText = `WRITE | ${publicFlag? 'PUBLIC' : 'SIGNED'}`; // eventually sepcify session as well
				cli.stateColor = WriteColor;
				messager.publicFlag = publicFlag;
				cli.render();
			},
			() => {
				cli.input.clearValue();
				cli.screen.focusPop();
			})
			.member(() => {
				cli.stateText = 'MEMBERS | initializing...';
				cli.stateColor = MemberColor;
				cli.render();
			})
			.revoke(prevState => {
				const challenge = phrase();
				revoker.challenge = challenge;
				cli.stateText = `REVOKE | from: ${prevState.name} | WARNING: revoking a key is irreversible!`;
				cli.stateColor = prevState.color;
				cli.revoke.show();
				cli.revoke.setLabel(` Enter '${challenge}' then press [Enter] to revoke your key THIS IS IRREVERSIBLE; Press [Enter] to return to ${prevState.name} mode `);
				cli.revoke.focus();
				cli.render();
			}, () => {
				cli.revoke.clearValue();
				cli.screen.focusPop();
				cli.revoke.hide();
			})
			.about(prevState => {
				cli.stateText = `ABOUT | from: ${prevState.name} | STOWAWAY version: ${VERSION}`;
				cli.setPopup('About STOWAWAY; [Escape] to return', ABOUT);
				cli.stateColor = prevState.color;
				cli.render();
			}, () => {
				cli.popup.hide();
			})
			.keybinds(prevState => {
				cli.stateText = `KEYBINDS | from: ${prevState.name}`;
				cli.stateColor = prevState.color;
				cli.setPopup(`Keybinds for ${prevState.name} state controls; [Escape] to return`, prevState.help);
				cli.render();
			}, () => {
				cli.popup.hide();
			})
			.build();

		// CLIENT EVENTS //

		client.on('channelUpdate', (channel0, channel1) => {
			if (channel0.id === hMediator.readingId) {
				const permissions = Permissions(channel1, client.user).valid;
				if (permissions.valid) {
					if (channel1.topic != null) {
						cli.messages.setLabel(` #${channel1.name} | ${channel1.topic} `);
					}
					else {
						cli.messages.setLabel(` #${channel1.name} `);
					}
				}
				else {
					const temp = [];
					if (!permissions.viewable) {
						temp.push('{underline}VIEW CHANNEL{/underline}');
					}
					if (!permissions.sendable) {
						temp.push('{underline}MESSAGE CHANNEL{/underline}');
					}
					if (!permissions.readable) {
						temp.push('{underline}READ MESSAGE HISTORY{/underline}');
					}
					if (channel0.topic != null) {
						cli.messages.setLabel(` {red-fg}#${channel0.name} | ${channel0.topic} | LACKING PERMISSIONS: ${temp.join(', ')}{/} `);
					}
					else {
						cli.messages.setLabel(` {red-fg}#${channel0.name} | LACKING PERMISSIONS: ${temp.join(', ')}{/} `);
					}
				}
			}
		});
		client.on('channelDelete', channel => {
			if (channel.id === hMediator.readingId) {
				let temp = '{red-fg}';
				if (channel.name != null) {
					temp += ` ${channel.name} |`;
				}
				if (channel.topic != null) {
					temp += ` ${channel.topic} |`;
				}
				temp += ' CHANNEL DELETED{/} ';
				cli.messages.setLabel(temp);
			}
		});

		// HELPFUL FUNCTIONS //

		const enterChannel = function (channel) {
			stowaway.numberStowaways(channel)
			.then(number => {
				allowTab = true;
				cli.enableInput();
				messager.channel = channel;
				hMediator.read(channel.id);
				messages.listen(channel.id);
				hMediator.read(channel.id);
				fsm.read({
					channelName: channel.name,
					guildName: channel.guild.name,
					topic: channel.topic,
					nickname: channel.members.find(member => member.id === client.user.id).nickname,
					numStowaways: number
				});
			})
			.catch(err => { throw err; });
		};
		/* I shouldn't need this HOPEFULLY
		const returnToChannel = function (channel) {
			stowaway.numberStowaways(channel)
			.then(number => {
				fsm.read({
					channelName: channel.name,
					guildName: channel.guild.name,
					topic: channel.topic,
					nickname: channel.members.find(member => member.id === client.user.id).nickname,
					numStowaway: number
				});
			})
			.catch(err => { throw err; });
		};
		*/

		// STOWAWAY EVENT LISTENING //

		stowaway.on('handshake channel', channel => {
			enterChannel(channel);
		});

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
		fsm.on('read channel', enterFlag => {
			if (enterFlag) {
				const channelId = hMediator.channelId();
				if (channelId != null) {
					client.channels.fetch(channelId)
					.then(channel => { enterChannel(channel); })
					.catch(err => { throw err; });
				}
			}
			else {
				fsm.read();
			}
		});

		//  STOWAWAY EVENT LISTENING  //

		fsm.on('navigate channels', next => { hMediator.scrollChannels(next); });
		fsm.on('navigate servers', next => { hMediator.scrollServers(next); });
		fsm.on('perform handshake', () => {
			const channel = cMediator.channelData();
			if (channel.valid) {
				client.channels.fetch(channel.id)
				.then(channel => { stowaway.loadChannel(channel); });
			}
		});
		fsm.on('handshake channels', next => { cMediator.scrollChannels(next); });
		fsm.on('handshake servers', next => { cMediator.scrollServers(next); });

		fsm.on('clear input', () => {
			cli.input.clearValue();
			fsm.read();
		});

		//  CLI DRIVEN STATE TRANSITIONS  //

		cli.input.on('submit', () => {
			if (messager.send(cli.input.value)) {
				fsm.read();
			}
		});
		cli.revoke.on('submit', () => {
		});

		//  KEYBINDING  //

		cli.screen.onceKey('C-c', () => { fsm.ctrlC(); });
		cli.input.onceKey('C-c', () => { fsm.ctrlC(); });
		cli.revoke.onceKey('C-c', () => { fsm.ctrlC(); });
		cli.screen.key('C-r', () => { fsm.ctrlR(); });
		cli.input.key('C-r', () => { fsm.ctrlR(); });
		cli.screen.key('C-a', () => { fsm.ctrlA(); });
		cli.input.key('C-a', () => { fsm.ctrlA(); });
		cli.revoke.key('C-a', () => { fsm.ctrlA(); });
		cli.screen.key('C-k', () => { fsm.ctrlK(); });
		cli.input.key('C-k', () => { fsm.ctrlK(); });
		cli.revoke.key('C-k', () => { fsm.ctrlA(); });
		cli.screen.key('escape', () => { fsm.escape(); });
		cli.input.key('escape', () => { fsm.escape(); });
		cli.revoke.key('escape', () => { fsm.escape(); });
		// these work in all states but input
		cli.screen.key(['e', 'S-e'], () => { fsm.e(); });
		cli.screen.key(['`', '~'], () => { fsm.backtick(); });
		// state specific
		cli.screen.key('enter', () => { fsm.enter(); });
		cli.screen.key('linefeed', () => { fsm.ctrlEnter(); });
		cli.screen.key('tab', () => {
			if (allowTab) {
				fsm.tab();
			}
		});
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
