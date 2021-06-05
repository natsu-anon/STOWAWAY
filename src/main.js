const process = require('process');

const { readFile, writeStream } = require('./utils.js');
const versionCheck = require('./version-check.js');
const initialize = require('./initialization.js');
const StowawayCLI = require('./stowaway-cli.js');
const { Permissions, Messenger } = require('./stowaway.js');
const { NavigateColor, ReadColor, WriteColor, HandshakeColor, MemberColor, RevokeColor } = require('./state_machine/state-colors.js');
const FSMBuilder = require('./state_machine/fsm-builder.js');
const { Revoker } = require('./revoker.js');
const revocationForm = require('./revoker-cli.js');
const MemberFactory = require('./member-factory.js');
const { ChannelsMediator, HandshakedMediator } = require('./mediators.js');
const { ChannelsModel, HandshakedModel, MessagesModel } = require('./models.js');

const VERSION_URL = 'https://raw.githubusercontent.com/natsu-anon/STOWAWAY/main/version.json';
const SCREEN_TITLE = 'ＳＴＯＷＡＷＡＹ';
const ERR_LOG = './error.log';

function main (VERSION, BANNER, DATABASE, API_TOKEN, PRIVATE_KEY, REVOCATION_CERTIFICATE, SAVE_DIR, tokenFlag) {
	let cli, client, db;
	const errStream = writeStream(ERR_LOG);
	// const check = await versionCheck(VERSION_URL, VERSION);
	versionCheck(VERSION_URL, VERSION)
		.then(check => initialize(BANNER, SCREEN_TITLE, DATABASE, API_TOKEN, PRIVATE_KEY, VERSION, REVOCATION_CERTIFICATE, SAVE_DIR, check, tokenFlag))
	.then(async ({ stowaway, client, key, passphrase, db, channels, peers, screen }) => {
		let allowTab = false; // block tabbing into read state until navigated away from the landing page & to a proper channel
		const ABOUT = require('./about.js')(BANNER);
		const invite = await client.generateInvite({
			permissions: [
				'VIEW_CHANNEL',
				'SEND_MESSAGES',
				'READ_MESSAGE_HISTORY',
				'CHANGE_NICKNAME'
			]
		});
		// const debugLog = writeStream('./debug.txt');

		//  COMMAND LINE INTERFACE  //

		cli = new StowawayCLI(screen, SCREEN_TITLE, client.user.username, client.user.tag, invite);
		const quit = () => {
			// debugLog.end();
			const stop = cli.spin('closing...');
			errStream.end();
			cli.destroy();
			client.destroy();
			db.close(() => {
				stop();
				process.exit(0);
			});
		};
		stowaway.on('error', error => { errStream.write(error); errStream.write('\n'); });
		// stowaway.on('debug', str => { debugLog.write(str); debugLog.write('\n'); });
		// stowaway.on('error', err => { cli.warn(err); });
		// stowaway.on('debug', debug => { cli.notify(`DEBUG: ${debug}`); });
		// stowaway.on('decryption failure', message => {
		// 	cli.notify(`failed to decrypt message from ${message.author.tag} on ${message.channel.name}`);
		// });
		// cli.screen.on('resize', () => { cli.render(); });

		await stowaway.launch(client, key, passphrase);

		//   COOMPOSITING  //

		const messenger = new Messenger(stowaway);
		const mFactory = new MemberFactory(stowaway, peers);
		const revoker = new Revoker(stowaway, client, PRIVATE_KEY, REVOCATION_CERTIFICATE).setKey(key);
		const hMediator = new HandshakedMediator(await (new HandshakedModel()).initialize(stowaway, client, channels), channels);
		const cMediator = new ChannelsMediator(await (new ChannelsModel()).initialize(stowaway, client, channels), invite);
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
		messages.on('update', text => {
			cli.messages.setContent(text);
			if (cli.messages.getScrollPerc() === 100 || cli.messages.height >= cli.messages.getScrollHeight()) {
				cli.messages.setScrollPerc(100);
			}
			cli.render();
		});

		//  FSM BUILDER

		const fsm = new FSMBuilder()
			.navigate(() => {
				// debugLog.write('navigate enter\n');
				cli.stateText = `NAVIGATE`;
				cli.stateColor = NavigateColor;
				cli.navigation.style.border.fg = 'green';
				cli.render();
			},
			() => {
				cli.navigation.style.border.fg = 'white';
				// debugLog.write('navigate exit\n');
			})
			.handshake(prevState => {
				// debugLog.write('handshake enter\n');
				cli.stateText = `HANDSHAKE | from: ${prevState.name}`;
				cli.stateColor = HandshakeColor;
				cli.select(box => {
					box.setLabel(' Select an available channel to handshake ');
					box.setContent(cMediator.text);
					box.setScrollPerc(cMediator.percentage);
					cli.selector.on('resize', () => {
						cli.selector.setScrollPerc(cMediator.percentage);
						cli.render();
					});
					cMediator.on('update', text => {
						cli.selector.setContent(text);
						cli.selector.setScrollPerc(cMediator.percentage);
						cli.render();
					});
				});
				cli.render();
			},
			() => {
				// debugLog.write('handshake exit\n');
				cMediator.removeAllListeners('update');
				cli.selector.removeAllListeners('resize');
				cli.selector.hide();
			})
			.read(() => {
				// debugLog.write('read enter\n');
				cli.stateText = `READ`; // eventually spit out a buncha information (including session)
				cli.stateColor = ReadColor;
				cli.messages.style.border.fg = 'green';
				cli.render();
			},
			() => {
				// debugLog.write('read exit\n');
				cli.messages.style.border.fg = 'white';
			})
			.write(() => {
				// debugLog.write('write enter\n');
				cli.input.focus();
				if (fsm._write.publicMessage) {
					cli.input.setLabel(` All stowaways will receive this message `);
				}
				else {
					cli.input.setLabel(` Only members whose keys you have signed will receive this message `);
				}
				cli.stateText = `WRITE`; // eventually sepcify session as well
				cli.stateColor = WriteColor;
				messenger.publicFlag = fsm._write.publicMessage;
				cli.input.style.border.fg = 'green';
				cli.render();
			},
			() => {
				// debugLog.write('write exit\n');
				cli.input.style.border.fg = 'white';
				cli.input.setLabel(` Message ${stowaway.channel.name} `);
				cli.input.cancel();
				cli.input.clearValue();
				cli.screen.focusPop();
				// cli.screen.grabKeys = false;
			})
			.member(prevState => {
				// debugLog.write('member enter\n');
				cli.select(box => {
					box.setLabel(' Loading channel information. ');
					box.setContent('loading...');
					cli.stateText = `MEMBERS | from: ${prevState.name}`;
					if (mFactory.current != null) {
						const mediator = mFactory.current;
						box.setLabel(` Members of {underline}${mediator.channel.guild.name}{/underline} #${mediator.channel.name} `);
						mediator.on('update', text => {
							box.setScrollPerc(mediator.percentage);
							box.setContent(text);
							cli.render();
						});
						box.on('resize', () => {
							box.setScrollPerc(mediator.percentage);
							cli.render();
						});
						fsm.on('scroll members', next => { mediator.scrollMembers(next); });
						fsm.on('sign member', () => { mediator.signMember(); });
						box.setContent('loading...');
						mediator.representation().then(text => {
							box.setContent(text);
							cli.render();
						});
					}
				});
				cli.stateColor = MemberColor;
				cli.render();
			},
			() => {
				cli.selector.removeAllListeners('resize');
				fsm.removeAllListeners('scroll members');
				fsm.removeAllListeners('sign member');
				if (mFactory.current != null) {
					mFactory.current.removeAllListeners('update');
				}
				cli.selector.hide();
			})
			.revoke(prevState => {
				cli.stateText = `REVOKE | from: ${prevState.name} `;
				const label = `REVOKE YOUR KEY; [Arrow Keys] to navigate form; [Escape] to return to ${prevState.name}`;
				cli.stateColor = RevokeColor;
				const { form, output } = revocationForm(cli.screen, label, {
					'C-c': () => { fsm.ctrlC(); },
					'C-a': () => { fsm.ctrlA(); },
					'C-k': () => { fsm.ctrlK(); }
				});
				form.on('submit', data => {
					const log = [];
					if (data.nickname.length === 0) {
						log.push('> Must enter a valid nickname!');
					}
					if (data.passphrase0.length === 0) {
						log.push('> Must enter a valid passphrase!');
					}
					else if (data.passphrase1 !== data.passphrase0) {
						log.push('> Passphrases do not match!');
					}
					if (log.length > 0) {
						log.push('Try again!');
						output.setContent(log.join('\n'));
					}
					else {
						cli.screen.lockKeys = true;
						form.setLabel(' {red-fg}REVOCATION IN PROCESS{/red-fg} ');
						log.push('> Revocation process initiated');
						log.push('> KEYS LOCKED');
						log.push('> Reading revocation certificate from disk...');
						output.setContent(log.join('\n'));
						cli.render();
						revoker.setNickname(data.nickname).setPassphrase(data.passphrase0);
						readFile(REVOCATION_CERTIFICATE)
						.then(revocationCertificate => {
							log.push('> PLEASE DO NOT CLOSE STOWAWAY');
							log.push('> Revoking key...');
							output.setContent(log.join('\n'));
							cli.render();
							return revoker.setRevocationCertificate(revocationCertificate).revoke();
						})
						.then(({ nickname, fingerprint }) => {
							let temp = '{underline}KEY REVOKED!{/underline}\n';
							temp += 'Always check that your key\'s nickname & fingerprint match what you remember!\n';
							temp += `> key nickname: {underline}${nickname}{/underline}\n`;
							temp += `> key fingerprint: {underline}${fingerprint}{/underline}\n`;
							temp += 'Move your new revocation ceritifcate to an offline storage device.';
							output.setContent(temp);
							form.reset();
						})
						.catch(err => {
							log.push(`{inverse}ERROR ENCOUNTERED DURING REVOCATION PROCESS!\n${err.stack}{/inverse}`);
							log.push('> KEYS UNLOCKED');
							output.setContent(log.join('\n'));
						})
						.finally(() => {
							form.setLabel(` {red-fg}${label}{/red-fg} `);
							cli.screen.lockKeys = false;
							cli.render();
						});
					}
				});
				cli.revoke = form;
				cli.revokeOutput = output;
				cli.render();
			}, () => {
				cli.screen.focusPop();
				if (cli.revoke != null) {
					cli.revoke.destroy();
				}
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
				cli.setPopup(`Keybinds for ${prevState.name} state controls; [Escape] to return`, prevState.keybinds);
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
			allowTab = true;
			cli.enableInput();
			messenger.channel = channel;
			hMediator.read(channel.id);
			mFactory.mediator(channel);
			cli.input.setLabel(` Message #${channel.name} `);
			if (channel.topic != null) {
				cli.messages.setLabel(` ${channel.guild.name} #${channel.name} | ${channel.topic} `);
			}
			else {
				cli.messages.setLabel(` ${channel.guild.name} #${channel.name} `);
			}
			fsm.read();
		};
		const fetchNewer = function (channelId, messageId) {
			if (channelId != null && messageId != null) {
				const stop = cli.spin('fetching newer messages');
				client.channels.fetch(channelId)
				.then(channel => stowaway.fetchNewer(channel, messageId))
				.finally(stop);
			}
		};
		const fetchOlder = function (channelId, messageId) {
			if (channelId != null && messageId != null) {
				const stop = cli.spin('fetching older messages');
				client.channels.fetch(channelId)
				.then(channel => stowaway.fetchOlder(channel, messageId))
				.finally(stop);
			}
		};

		// STOWAWAY EVENT LISTENING //

		stowaway.on('read channel', channel => {
			enterChannel(channel);
		});


		// PROCESS EVENT LISTENING //

		// emitted on Windows the console window is closed & on other platforms under similar conditions
		// see https://nodejs.org/dist/latest-v14.x/docs/api/process.html#process_signal_events
		process.once('SIGHUP', quit);

		//  FSM EVENT LISTENING  //

		fsm.once('quit', quit);
		fsm.on('read channel', enterFlag => {
			if (enterFlag) {
				const channelId = hMediator.channelId();
				if (channelId != null) {
					messages.listen(channelId);
					client.channels.fetch(channelId)
					.then(channel => { stowaway.loadChannel(channel); })
					.catch(err => { throw err; });
				}
			}
			else {
				fsm.read();
			}
		});
		fsm.on('channel members', state => {
			if (hMediator.readingId != null) {
				fsm.member(state);
			}
		});
		fsm.on('clear favorite', navigatorFlag => {
			if (navigatorFlag) {
				const channelId = hMediator.channelId();
				if (channelId != null) {
					hMediator.clearFavorite(channelId);
				}
			}
			else if (hMediator.readingId != null) {
				hMediator.clearFavorite(hMediator.readingId);
			}
		});
		fsm.on('set favorite', (navigatorFlag, number) => {
			if (navigatorFlag) {
				const channelId = hMediator.channelId();
				if (channelId != null) {
					hMediator.setFavorite(number, channelId);
				}
			}
			else if (hMediator.readingId != null) {
				hMediator.setFavorite(number, hMediator.readingId);
			}
		});
		fsm.on('to favorite', number => {
			hMediator.favoriteId(number)
			.then(channelId => {
				if (channelId != null) {
					messages.listen(channelId);
					client.channels.fetch(channelId)
					.then(channel => { stowaway.loadChannel(channel); })
					.catch(err => { throw err; });
				}
			});
		});

		//  STOWAWAY EVENT LISTENING  //

		fsm.on('navigate channels', next => { hMediator.scrollChannels(next); });
		fsm.on('navigate servers', next => { hMediator.scrollServers(next); });
		fsm.on('perform handshake', () => {
			const channel = cMediator.channelData();
			if (channel.valid) {
				messages.listen(channel.id);
				client.channels.fetch(channel.id)
				.then(channel => { stowaway.loadChannel(channel); });
			}
		});
		fsm.on('handshake channels', next => { cMediator.scrollChannels(next); });
		fsm.on('handshake servers', next => { cMediator.scrollServers(next); });
		fsm.on('messages top', () => { cli.messages.setScrollPerc(0); });
		fsm.on('messages bottom', () => { cli.messages.setScrollPerc(100); });
		fsm.on('scroll messages', offset => {
			if (cli.messages.height >= cli.messages.getScrollHeight()) {
				if (offset > 0) {
					fetchNewer(hMediator.readingId, messages.newestId);
				}
				else {
					fetchOlder(hMediator.readingId, messages.oldestId);
				}
			}
			else {
				if (cli.messages.getScrollPerc() === 0 && offset < 0) {
					fetchOlder(hMediator.readingId, messages.oldestId);
				}
				else if (cli.messages.getScrollPerc() === 100 && offset > 0) {
					fetchNewer(hMediator.readingId, messages.newestId);
				}
				else {
					cli.messages.scroll(offset);
				}
			}
		});
		fsm.on('clear input', () => {
			cli.input.clearValue();
			fsm.read();
		});

		//  CLI DRIVEN STATE TRANSITIONS  //

		cli.input.on('submit', () => {
			if (cli.input.value.length > 0) {
				messenger.message(cli.input.value);
			}
			fsm.read();
		});

		//  KEYBINDING  //

		cli.screen.onceKey('C-c', () => { fsm.ctrlC(); });
		cli.screen.key('C-r', () => { fsm.ctrlR(); });
		cli.screen.key('C-a', () => { fsm.ctrlA(); });
		cli.screen.key('C-k', () => { fsm.ctrlK(); });
		cli.screen.key('escape', () => { fsm.escape(); });
		cli.input.onceKey('C-c', () => { fsm.ctrlC(); });
		cli.input.key('C-r', () => { fsm.ctrlR(); });
		cli.input.key('C-a', () => { fsm.ctrlA(); });
		cli.input.key('C-k', () => { fsm.ctrlK(); });
		cli.input.key('escape', () => { fsm.escape(); });
		// these work in all states but input
		cli.screen.key(['h', 'S-h'], () => { fsm.h(); });
		cli.screen.key(['m', 'S-m'], () => { fsm.m(); });
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
		cli.screen.key(['backspace', 'delete'], () => { fsm.backspace(); });
		cli.screen.key('0', () => { fsm.num0(); });
		cli.screen.key('1', () => { fsm.num1(); });
		cli.screen.key('2', () => { fsm.num2(); });
		cli.screen.key('3', () => { fsm.num3(); });
		cli.screen.key('4', () => { fsm.num4(); });
		cli.screen.key('5', () => { fsm.num5(); });
		cli.screen.key('6', () => { fsm.num6(); });
		cli.screen.key('7', () => { fsm.num7(); });
		cli.screen.key('8', () => { fsm.num8(); });
		cli.screen.key('9', () => { fsm.num9(); });
		cli.screen.key(')', () => { fsm.shift0(); });
		cli.screen.key('!', () => { fsm.shift1(); });
		cli.screen.key('@', () => { fsm.shift2(); });
		cli.screen.key('#', () => { fsm.shift3(); });
		cli.screen.key('$', () => { fsm.shift4(); });
		cli.screen.key('%', () => { fsm.shift5(); });
		cli.screen.key('^', () => { fsm.shift6(); });
		cli.screen.key('&', () => { fsm.shift7(); });
		cli.screen.key('*', () => { fsm.shift8(); });

		// NOTE this makes it so blessed doesn't crash if launch > revoke > navigate > handshake
		// do I know why this works?  fucno.
		cli.select(box => {
			box.setLabel(` STOWAWAY VERSION ${VERSION}`);
			box.setContent('completing initialization....');
		});
		cli.selector.hide();
		cli.render();
	})
	.catch(err => {
		if (cli != null) {
			cli.destroy();
		}
		if (client != null) {
			client.destroy();
		}
		if (db != null) {
			db.close();
		}
		if (err != null) {
			errStream.write(`CRITICAL ERROR:\n${err}`);
			console.error(err);
		}
		errStream.end();
		console.log('If you believe a bug caused this you can report it here: \x1b[4mhttps://github.com/natsu-anon/STOWAWAY/issues/new/choose\x1b[0m');
		console.log('See \'error.log\' for the error log');
		console.log('\nPass --help to see usage information');
		console.log('Press [Ctrl-C] to quit');
	});
}

module.exports = main;
