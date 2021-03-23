const fs = require('fs');
const process = require('process');
const { Client } = require('discord.js');

const versionCheck = require('/version-check.js');
const dbInit = require('./database.js');
const keyInit = require('./key.js');
const clientInit = require('./client.js');

const SingleChannel = require('./models/single-channel.js');
const { Stowaway } = require('./stowaway.js');
const ChannelSelect = require('./channel-select.js');
const InitCLI = require('./init-cli.js');
const SingleCLI = require('./single-cli.js');
const { FSMBuilder } = require('./state_machine/builder.js');

const SCREEN_TITLE = 'ＳＴＯＷＡＷＡＹ';

const warning = `
{black-fg}{yellow-bg}## {underline}WARNING{/underline} ##########################################{/}
{black-fg}{yellow-bg}#                                                   #{/}
{black-fg}{yellow-bg}#  ENSURE YOUR BINARY/SOURCE CODE IS FROM:          #{/}
{black-fg}{yellow-bg}#  {underline}github.com/natsu-anon/STOWAWAY{/underline}                   #{/}
{black-fg}{yellow-bg}#  DO NOT SHARE stowaway.db WITH ANYONE.            #{/}
{black-fg}{yellow-bg}#  DO NOT SHARE stowaway.key WITH ANYONE.           #{/}
{black-fg}{yellow-bg}#  DO NOT SHARE stowaway.token WITH ANYONE.         #{/}
{black-fg}{yellow-bg}#  DO NOT SHARE stowaway.revoke WITH ANYONE.        #{/}
{black-fg}{yellow-bg}#                                                   #{/}
{black-fg}{yellow-bg}#  DO NOT TRUST ANY GOVERNMENT.                     #{/}
{black-fg}{yellow-bg}#  DO NOT TRUST CORPORATIONS & COMPANIES.           #{/}
{black-fg}{yellow-bg}#  {underline}DO NOT TRUST GROOMERS.{/underline}                           #{/}
{black-fg}{yellow-bg}#                                                   #{/}
{black-fg}{yellow-bg}#  THIS SOFTWARE DOES NOT WORK AGAINST KEYLOGGERS.  #{/}
{black-fg}{yellow-bg}#  - NOR -                                          #{/}
{black-fg}{yellow-bg}#  {underline}PEOPLE STANDING BEHIND YOU.{/underline}                      #{/}
{black-fg}{yellow-bg}#                                                   #{/}
{black-fg}{yellow-bg}#####################################################{/}
\n`;

/* LANCH PROCEDURE:
 * 1. VERSION CHECK
 *		- if not up to date: notify user:
 *		a) most recent version
 *		b) where to download most recent version
 *		c) HOW to update (just drag in the new binary)
 * 2. DB INITIALIZATION
 * 3. CLIENT LOGIN (but not hooked up to stowaway and all that)
 *		- if no API token found request then save it
 * 4. PGP KEY GEN LOGIN
 *		- if no key found ask user for password (MAKE SURE THEY ENTER IT TWICE)
 *		- warn them that if they forget their password they will NOT be able to recover it and MUST revoke their key
 * 5. STOWAWAY
*/

function main (BANNER, DATABASE, API_TOKEN, PRIVATE_KEY, REVOCATION_CERTIFICATE) {
	let cli = new InitCLI(BANNER, SCREEN_TITLE, process);
	cli.log(warning);
	cli.log('>intiliazing pgp keys... ');
	keyInit(PRIVATE_KEY, fs, cli)
	.then(k => {
		cli.cat('{green-fg}DONE!{/}');
		cli.log('>initialiazing database... ');
		return new Promise((resolve, reject) => {
			dbInit(DATABASE)
			.then(db => {
				cli.cat('{green-fg}DONE!{/}');
				resolve({
					key: k,
					database: db
				});
			})
			.catch(reject);
		});
	})
	.then(({ key: k, database: db }) => {
		cli.log('>initializing discord client...');
		return new Promise((resolve, reject) => {
			clientInit(API_TOKEN, fs, cli, Client)
			.then(client => {
				client.user.setStatus('dnd');
				cli.cat(`{green-fg}DONE!{/}`);
				cli.log(`>logged in as {black-fg}{green-bg}${client.user.tag}{/}`);
				resolve({
					key: k,
					database: db,
					client: client
				});
			})
			.catch(reject);
		});
	})
	.then(({ key: k, database: db, client: client }) => {
		return new Promise((resolve, reject) => {
			cli.select(ChannelSelect(cli, db, client))
			.then((channel_id) => {
				cli.log('>attempting to connect to target channel... ');
				client.channels.fetch(channel_id)
				.then(channel => {
					cli.cat(`{green-fg}DONE!{/}`);
					cli.log(`>channel: ${channel.guild.name} {black-fg}{green-bg}#${channel.name}{/}`);
					resolve({
						key: k,
						database: db,
						client: client,
						channel: channel
					});
				})
				.catch(reject);
			})
			.catch(reject);
		});
	})
	.then(({ key: key, database: db, client: client, channel: channel }) => {
		const stowaway = new SingleStowaway(key, channel, db);
		const model = new SingleChannel();
		client.on('message', message => {
			if (message.channel.type === 'dm' && !message.author.bot) {
				if (message.content === 'about') {
					let about = `Hello ${message.author.username}, I'm a STOWAWAY bot!`;
					about += 'That means I allow my user to send & receive encrypted messages with ease.  ';
					about += 'You can learn more about STOWAWAY and get your own at: https://github.com/natsu-anon/STOWAWAY';
					message.reply(about);
				}
				else {
					message.reply("dm me 'about' to learn about what I do");
				}
			}
		});
		client.user.setPresence({
			activity: {
				type: 'LISTENING',
				name: ' dms for "about"'
			},
			status: 'online'
		});
		cli.destroy();
		cli = new SingleCLI(SCREEN_TITLE, '{bold}[Ctrl-C] to quit{/bold}', `${channel.guild.name} {green-fg}#${channel.name}{/}`, client.user.tag);
		stowaway.on('message', model.message);
		stowaway.on('error', err => { cli.error(err); });
		stowaway.on('timestamp', (ts, id) => { model.timestamp(ts, id); });
		stowaway.on('failed decrypt', model.decryptionFailure);
		stowaway.on('handshake', model.handshake);
		stowaway.on('notify', message => { cli.notify(message); });
		stowaway.on('debug', message => { cli.warning(`DEBUG: ${message}`); });
		stowaway.on('channel delete', () => { cli.error(`${channel.name} deleted!`); });
		stowaway.on('channel update', ch => {
			cli.notify('channel updated!');
			cli.channelLabel = `${ch.guild.name} {green-fg}#${ch.name}{/}`;
			cli.render();
		});
		stowaway.on('bad handshake', user => {
			cli.warning(`BAD HANDSHAKE from ${user.tag}`);
		});
		stowaway.on('handshake', (ts, date, user) => {
			cli.handshake(`HANDSHAKE from ${user.tag}`);
		});
		model.on('update', () => {
			const flag = cli.channelScrollPerc === 100 || cli.channelHeight >= cli.channelScrollHeight;
			cli.messages = model.text;
			if (flag) {
				cli.scrollChannelPerc(100);
			}
			else {
				cli.render();
			}
		});
		stowaway.launch(client);
		stowaway.on('message', (ts, date, author, content) => {
			cli.encrypted(`new message from ${author.tag}`);
		});
		cli.messages = model.text;
		const fsm = new FSMBuilder()
		.enterRead(() => {
			cli.stateBG = 'magenta';
			cli.stateText = 'READING -- [SPACE] begin writing; [W] scroll up/fetch older messages; [S] scroll down/fetch newer messages; [1] to jump to bottom';
			cli.render();
		})
		.enterWrite(() => {
			if (!cli.inputBox.focused) {
				cli.screen.focusPush(cli.inputBox);
				cli.stateBG = 'green';
				cli.stateText = 'WRITING -- [ESCAPE] to stop writing; [ENTER] to send';
				cli.render();
			}
		})
		.exitWrite(() => {
			if (cli.inputBox.focused) {
				cli.screen.focusPop();
				cli.render();
			}
		})
		.build();
		fsm.on('quit', () => {
			client.destroy();
			db.persistence.compactDatafile();
			return process.exit(0);
		});
		cli.screen.key(['space'], () => {
			fsm.onSpace();
		});
		cli.screen.key(['C-c'], () => {
			fsm.onCtrlC();
		});
		cli.screen.key(['enter'], () => {
			fsm.onEnter();
		});
		cli.screen.key(['escape'], () => {
			fsm.onEsc();
		});
		cli.screen.key(['w'], () => {
			fsm.onW();
		});
		cli.screen.key(['s'], () => {
			fsm.onS();
		});
		cli.inputBox.key(['C-c'], () => {
			fsm.onCtrlC();
		});
		cli.inputBox.key(['enter'], () => {
			fsm.onEnter();
		});
		cli.inputBox.key(['escape'], () => {
			fsm.onEsc();
		});
		cli.screen.key(['1'], () => {
			cli.scrollChannelPerc(100);
		});
		fsm.on('send input', () => {
			stowaway.encrypt(cli.submitInput());
		});
		fsm.on('clear input', () => {
			cli.cancelInput();
		});
		const fetchOlder = function () {
			stowaway.fetchOlder(model.oldest)
			.then(() => { cli.notify('fetched older messages!'); });
		};
		const fetchNewer = function () {
			stowaway.fetchNewer(model.newest)
			.then(() => { cli.notify('fetched newer messages!'); });
		};
		fsm.on('scroll', offset => {
			if (cli.channelHeight >= cli.channelScrollHeight) {
				if (offset > 0) {
					fetchNewer();
				}
				else if (offset < 0) {
					fetchOlder();
				}
			}
			else {
				if (cli.channelScrollPerc === 0 && offset < 0) {
					fetchOlder();
				}
				else if (cli.channelScrollPerc === 100 && offset > 0) {
					fetchNewer();
				}
				else {
					cli.scrollChannel(offset);
				}
			}
		});
	})
	.catch(err => {
		cli.destroy();
		console.error(err);
		console.log('Pass --help to see usage information');
		console.log('[Ctrl-C] to quit');
	});
}

module.exports = main;
