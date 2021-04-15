const process = require('process');
const fs = require('fs');

const phrase = require('./nato-phrase.js');
const versionCheck = require('./version-check.js');
const initialize = require('./initialization.js');
const StowawayCLI = require('./stowaway-cli.js');
const { Permissions, Messenger } = require('./stowaway.js');
const { NavigateColor, ReadColor, WriteColor, MemberColor } = require('./state_machine/state-colors.js');
const FSMBuilder = require('./state_machine/fsm-builder.js');
const Revoker = require('./revoker.js');
const MemberFactory = require('./member-factory.js');
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

		const messenger = new Messenger(stowaway);
		const mFactory = new MemberFactory(stowaway, db);
		let mPromise;
		const revoker = new Revoker(stowaway, client, PRIVATE_KEY, REVOCATION_CERTIFICATE).setKey(key);
		const hMediator = new HandshakedMediator(await (new HandshakedModel()).initialize(stowaway, client, db));
		const cMediator = new ChannelsMediator(await (new ChannelsModel()).initialize(stowaway, client, db));

		//  COMMAND LINE INTERFACE  //

		cli = new StowawayCLI(SCREEN_TITLE, client.user.tag);
		stowaway.on('error', error => { cli.warn(error); });
		stowaway.on('debug', debug => { cli.notify(`DEBUG: ${debug}`); });
		stowaway.on('decryption failure', message => {
			cli.notify(`failed to decrypt message from ${message.author.tag} on ${message.channel.name}`);
		});
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
				cli.navigation.style.border.fg = 'green';
				cli.render();
			},
			() => {
				cli.navigation.style.border.fg = 'white';
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
			.read(({ guildName, channelName, displayName, topic, statelineOnly }) => {
				if (!statelineOnly) {
					if (topic != null) {
						cli.messages.setLabel(` #${channelName} | ${topic} `);
					}
					else {
						cli.messages.setLabel(` #${channelName} `);
					}
				}
				cli.stateText = `READ | ${guildName} | ${displayName} | loading...`; // eventually specify session as well
				mPromise.then(mediator => {
					const num = mediator.numMembers;
					let temp = `READ | ${guildName} | ${displayName} | `;
					if (num === 0) {
						temp += '0 fellow stowaways';
					}
					else if (num === 1) {
						temp += '1 fellow stowaway';
					}
					else {
						temp += `${num} fellow stowaways`;
					}
					cli.stateText = temp;
					cli.render();
				});
				cli.input.setLabel(` Message #${channelName} `);
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
				cli.stateText = `WRITE | ${publicFlag ? 'PUBLIC' : 'SIGNED'}`; // eventually sepcify session as well
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
			.member(() => {
				cli.select(box => {
					box.setLabel(' Loading channel information. ');
					box.setContent('loading...');
					cli.stateText = 'MEMBERS | loading... ';
					mPromise.then(mediator => {
						box.setLabel(` Members of {underline}${mediator.channel.guild.name}{/underline} #${mediator.channel.name} `);
						let temp = 'MEMBERS | ';
						const num = mediator.numMembers;
						if (num === 0) {
							temp += '0 fellow stowaways';
						}
						else if (num === 1) {
							temp += '1 fellow stowaway';
						}
						else {
							temp += `${num} fellow stowaways`;
						}
						cli.stateText = temp;
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
				cli.stateColor = prevState.color;
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
			allowTab = true;
			cli.enableInput();
			messenger.channel = channel;
			hMediator.read(channel.id);
			mPromise = mFactory.mediator(channel);
			fsm.read({
				channelName: channel.name,
				guildName: channel.guild.name,
				topic: channel.topic,
				displayName: channel.members.find(member => member.id === client.user.id).displayName,
			});
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

		stowaway.on('read channel', channel => {
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
		fsm.on('channel members', () => {
			if (hMediator.readingId != null) {
				fsm.member();
			}
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
		fsm.on('scroll messages', offset => { cli.messages.scroll(offset); });
		fsm.on('messages top', () => { cli.messages.setScrollPerc(0); });
		fsm.on('messages bottom', () => { cli.messages.setScrollPerc(100); });

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
