const process = require('process');
const fs = require('fs');

const phrase = require('./nato-phrase.js');
const versionCheck = require('./version-check.js');
const initialize = require('./initialization.js');
const StowawayCLI = require('./stowaway-cli.js');
const { Permissions, Messenger } = require('./stowaway.js');
const { NavigateColor, ReadColor, WriteColor, HandshakeColor, MemberColor, RevokeColor,  } = require('./state_machine/state-colors.js');
const FSMBuilder = require('./state_machine/fsm-builder.js');
const { Revoker } = require('./revoker.js');
const MemberFactory = require('./member-factory.js');
const { ChannelsMediator, HandshakedMediator } = require('./mediators.js');
const { ChannelsModel, HandshakedModel, MessagesModel } = require('./models.js');

// NOTE update url to use main branch
const VERSION_URL = 'https://raw.githubusercontent.com/natsu-anon/STOWAWAY/main/version.json';
const SCREEN_TITLE = 'ＳＴＯＷＡＷＡＹ';
const ERR_LOG = './error.log';

function main (VERSION, BANNER, DATABASE, API_TOKEN, PRIVATE_KEY, REVOCATION_CERTIFICATE) {
	let cli, client;
	const errStream = fs.createWriteStream(ERR_LOG);
	// const check = await versionCheck(VERSION_URL, VERSION);
	versionCheck(VERSION_URL, VERSION)
	.then(check => initialize(BANNER, SCREEN_TITLE, DATABASE, API_TOKEN, PRIVATE_KEY, VERSION, REVOCATION_CERTIFICATE, check))
	.then(async ({ stowaway, client, key, passphrase, db, screen }) => {
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

		//  COMMAND LINE INTERFACE  //

		cli = new StowawayCLI(screen, SCREEN_TITLE, client.user.tag, invite);
		stowaway.on('error', error => { errStream.write(error); });
		// stowaway.on('debug', debug => { cli.notify(`DEBUG: ${debug}`); });
		// stowaway.on('decryption failure', message => {
		// 	cli.notify(`failed to decrypt message from ${message.author.tag} on ${message.channel.name}`);
		// });
		// cli.screen.on('resize', () => { cli.render(); });

		await stowaway.launch(client, key, passphrase);

		//   COOMPOSITING  //

		const messenger = new Messenger(stowaway);
		const mFactory = new MemberFactory(stowaway, db);
		let mPromise;
		const revoker = new Revoker(stowaway, client, PRIVATE_KEY, REVOCATION_CERTIFICATE).setKey(key);
		const hMediator = new HandshakedMediator(await (new HandshakedModel()).initialize(stowaway, client, db), db);
		const cMediator = new ChannelsMediator(await (new ChannelsModel()).initialize(stowaway, client, db), invite);
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
		hMediator.representation()
		.then(text => {
			cli.navigation.setContent(text);
			cli.navigation.setScrollPerc(hMediator.percentage);
		});
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
				cli.stateText = `NAVIGATE | more information will be shown here next release`;
				cli.stateColor = NavigateColor;
				cli.navigation.style.border.fg = 'green';
				cli.render();
			},
			() => {
				cli.navigation.style.border.fg = 'white';
			})
			.handshake(prevState => {
				cli.stateText = `HANDSHAKE | from: ${prevState.name} | more information will be shown here next release`;
				cli.stateColor = HandshakeColor;
				cli.select(box => {
					box.setLabel(' Select an available channel to handshake ');
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
			.read(() => {
				cli.stateText = `READ | more information will be shown here next release`; // eventually spit out a buncha information (including session)
				cli.stateColor = ReadColor;
				cli.messages.style.border.fg = 'green';
				cli.render();
			},
			() => {
				cli.messages.style.border.fg = 'white';
			})
			.write(publicFlag => {
				cli.input.focus();
				if (publicFlag) {
					cli.input.setLabel(` All stowaways will receive this message `);
				}
				else {
					cli.input.setLabel(` Only members whose keys you have signed will receive this message `);
				}
				cli.stateText = `WRITE | more information will be shown here next release`; // eventually sepcify session as well
				cli.stateColor = WriteColor;
				messenger.publicFlag = publicFlag;
				cli.input.style.border.fg = 'green';
				cli.render();
			},
			() => {
				cli.input.style.border.fg = 'white';
				cli.input.clearValue();
				cli.screen.focusPop();
			})
			.member(prevState => {
				cli.select(box => {
					box.setLabel(' Loading channel information. ');
					box.setContent('loading...');
					cli.stateText = `MEMBERS | from: ${prevState.name} | more information will be shown here next release`;
					mPromise.then(mediator => {
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
						return mediator.representation();
					})
					.then(text => {
						box.setContent(text);
						cli.render();
					});
				});
				cli.stateColor = MemberColor;
				cli.render();
			},
			() => {
				cli.selector.removeAllListeners('resize');
				mPromise.then(() => {
					fsm.removeAllListeners('scroll members');
					fsm.removeAllListeners('sign member');
				});
				cli.selector.hide();
			})
			.revoke(prevState => {
				const challenge = phrase();
				revoker.challenge = challenge;
				cli.stateText = `REVOKE | from: ${prevState.name} | STEP 1: CHALLENGE | WARNING: revoking a key is irreversible!`;
				cli.stateColor = RevokeColor;
				cli.revoke.show();
				const temp = `; press [Escape] to return to ${prevState.name}`;
				const label = `Enter '${challenge}' then press [Enter] to begin revoking your key${temp}`;
				cli.revokeLabel = label;
				cli.revoke.focus();
				cli.revoke.censor = false;
				// revocation sequence:
				// nickname
				// password #1
				// password #2
				// read revocation cert from disk
				// display nickname & fingerprint
				new Promise((resolve, reject) => {
					cli.revoke.once('submit', () => {
						if (revoker.checkChallenge(cli.revoke.value)) {
							resolve();
						}
						else {
							reject();
						}
					});
				})
				.then(() => {
					cli.revoke.focus();
					cli.revoke.clearValue();
					cli.revokeLabel = `Enter a valid nickname for your new key then press [Enter] to proceed${temp}`;
					cli.stateText = `REVOKE | from: ${prevState.name} | STEP 2: NICKNAME | WARNING: revoking a key is irreversible!`;
					cli.render();
					return new Promise((resolve, reject) => {
						cli.revoke.once('submit', () => {
							if (cli.revoke.value.length > 0) {
								resolve(cli.revoke.value);
							}
							else {
								reject();
							}
						});
					});
				})
				.then(nickname => {
					cli.revoke.focus();
					cli.revoke.clearValue();
					revoker.setNickname(nickname);
					cli.revoke.censor = true;
					cli.revokeLabel = `Enter a passphrase for your new key then press [Enter] to continue${temp}`;
					cli.stateText = `REVOKE | from: ${prevState.name} | NICKNAME: ${nickname} | STEP 3: PASSPHRASE | WARNING: revoking a key is irreversible!`;
					cli.render();
					return new Promise((resolve, reject) => {
						cli.revoke.once('submit', () => {
							if (cli.revoke.value.length > 0) {
								resolve(cli.revoke.value);
							}
							else {
								reject();
							}
						});
					});
				})
				.then(passphrase => {
					cli.revoke.focus();
					cli.revoke.clearValue();
					cli.revokeLabel = `Re-enter the passphrase then press [Enter] to continue${temp}`;
					cli.stateText = `REVOKE | from: ${prevState.name} | NICKNAME: ${revoker.nickname} | STEP 4: PASSPHRASE CONFIRMATION | WARNING: revoking a key is irreversible!`;
					cli.render();
					return new Promise((resolve, reject) => {
						cli.revoke.once('submit', () => {
							if (cli.revoke.value === passphrase) {
								resolve(passphrase);
							}
							else {
								reject();
							}
						});
					});
					
				})
				.then(passphrase => {
					fsm.revokeLock();
					revoker.setPassphrase(passphrase);
					cli.screen.focusPop();
					cli.revoke.hide();
					const stopSpinning = cli.spin('reading revocation certificate from disk...');
					cli.stateText = `REVOKE | from: ${prevState.name} | NICKNAME: ${revoker.nickname} | STEP 5: reading revocation certificate | IT'S TOO LATE`;
					cli.revoke.clearValue();
					return new Promise((resolve, reject) => {
						fs.readFile(REVOCATION_CERTIFICATE, (err, data) => {
							if (err != null) {
								reject(err);
							}
							else {
								resolve(data);
							}
						});
					})
					.finally(() => {
						stopSpinning();
					});
				})
				.then(revocationCertificate => {
					cli.stateText = `REVOKE | from: ${prevState.name} | REVOKING KEY | IT'S TOO LATE`;
					const stopSpinning = cli.spin('revoking key...');
					return revoker.setRevocationCertificate(revocationCertificate).revoke()
					.finally(() => { stopSpinning(); });

				})
				.then(({ nickname, fingerprint }) => {
					cli.stateText = `REVOKE | from: ${prevState.name} | REVOCATION PROCESS COMPLETE`;
					let temp = 'Always check that your key\'s nickname & fingerprint match what you remember!\n';
					temp += `> key nickname: {underline}${nickname}{/underline}\n`;
					temp += `> key fingerprint: {underline}${fingerprint}{/underline}\n`;
					temp += 'Move your new revocation ceritifcate to an offline storage device.';
					const box = cli.keyData(temp);
					return new Promise(resolve => {
						box.once('destroy', () => {
							resolve();
						});
					});
				})
				.then(() => {
					fsm.revokeUnlock();
					fsm.escape();
				})
				.catch(err => {
					if (err != null) {
						cli.warn(`Error while revoking:\n${err}`);
					}
					cli.revoke.clearValue();
					cli.revoke.removeAllListeners('submit');
					fsm.revoke(prevState);
				})
				.finally(() => {
					fsm.revokeUnlock();
				});
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
			mPromise = mFactory.mediator(channel);
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

		//  FSM EVENT LISTENING  //

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
			if (messenger.message(cli.input.value)) {
				fsm.read();
			}
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
		cli.screen.key('(', () => { fsm.shift9(); });
	})
	.catch(err => {
		if (cli != null) {
			cli.destroy();
		}
		if (client != null) {
			client.destroy();
		}
		if (err != null) {
			errStream.write(`TERMINAL ERROR:\n${err}`);
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
