const fs = require('fs');
const process = require('process');
const { Client } = require('discord.js');

const dbInit = require('./database.js');
const keyInit = require('./key.js');
const clientInit = require('./client.js');

const SingleChannel = require('./models/single-channel.js');
const { SingleStowaway } = require('./single-stowaway.js');
const ChannelSelect = require('./channel-select.js');
const InitCLI = require('./init-cli.js');
const SingleCLI = require('./single-cli.js');
const { FSMBuilder } = require('./state_machine/builder.js');

const SCREEN_TITLE = 'ＳＴＯＷＡＷＡＹ';
const DATABASE = './stowaway.db';
const PRIVATE_KEY = './stowaway.key';
const API_TOKEN = './token DO NOT SHARE';
const SC_TARGET = './channel_id.txt';
// const REVOCATION_CERT = './stowaway.cert';

const banner = `      _  __ __        __        __
 //  /_\` / / / | | | /_/ | | | /_/ /_/  //
//  ._/ / /_/  |/|/ / /  |/|/ / /  /   //  v 0.3.0
This software is licensed under the WTFPL`

const warning = `
{black-fg}{yellow-bg}## {underline}WARNING{/underline} ###################################{/}
{black-fg}{yellow-bg}#                                            #{/}
{black-fg}{yellow-bg}#  ENSURE YOUR BINARY/SOURCE CODE IS FROM:   #{/}
{black-fg}{yellow-bg}#  {underline}github.com/natsu-anon/STOWAWAY{/underline}            #{/}
{black-fg}{yellow-bg}#  DO NOT SHARE YOUR API TOKEN WITH ANYONE.  #{/}
{black-fg}{yellow-bg}#  DO NOT SHARE stowaway.db WITH ANYONE.     #{/}
{black-fg}{yellow-bg}#  DO NOT SHARE stowaway.key WITH ANYONE.    #{/}
{black-fg}{yellow-bg}#  DO NOT TRUST THE GOVERNMENT.              #{/}
{black-fg}{yellow-bg}#  {underline}DO NOT TRUST CORPORATIONS.{/underline}                #{/}
{black-fg}{yellow-bg}#                                            #{/}
{black-fg}{yellow-bg}##############################################{/}
\n`;

if (process.argv.length > 2 && (process.argv[2] == '--channels' || process.argv[2] == '-c')) {
	require('./list-channels.js')(API_TOKEN, Client);
	/*
	const cli = new InitCLI(banner, SCREEN_TITLE, process);
	cli.log(`{green-fg}#### STOWAWAY passed {underline}${process.argv[2]}{/underline}.  Commencing channel scan!{/}`);
	cli.log("{underline}{yellow-fg}THIS FEATURE WILL BE REMOVED ONCE SERVER NAVIGATION IS IMPLEMENTED{/}");
	cli.log(">initializing discord client...");
	clientInit(API_TOKEN, fs, cli, Client)
	.then(client => {
		cli.cat(`{green-fg}DONE!{/}`);
		cli.log(`>Logged in as {black-fg}{green-bg}${client.user.tag}{/}`);
		client.guilds.cache.each(guild => {
			cli.log(`\nSERVER: {green-fg}{underline}${guild.name}{/}`);
			guild.channels.cache.filter(channel => channel.isText())
			.each(channel => {
				cli.log(`- {green-fg}${channel.id}{/} #${channel.name}`);
			});
		});
		cli.log("\n[Ctrl-C] to quit...");
	})
	.catch(err => {
		cli.destroy();
		console.error(err);
		process.exit(1);
	});
	*/
}
else if (process.argv.length > 2 && (process.argv[2] == '--version' || process.argv[2] == '-v')) {
	console.log("0.3.0");
}
else if (process.argv.length > 2 && (process.argv[2] == '--about' || process.argv[2] == '-a')) {
	require('./about.js')(banner);
}
else if (process.argv.length > 2 && (process.argv[2] == '--help' || process.argv[2] == '-h')) {
	require('./help.js')();
	/*
	console.log("STOWAWAY [options] <target channel id>");
	console.log("Options:")
	console.log("\t-h, --help\t\t output usage information");
	console.log("\t-c, --channels\t\t print all available channels with id");
	*/
}
else {
	// TODO get this all in its own script because MY GOODNESS
	let cli = new InitCLI(banner, SCREEN_TITLE, process);
	cli.log(warning);
	cli.log(">intiliazing pgp keys... ");
	keyInit(PRIVATE_KEY, fs, cli)
	.then(k => {
		cli.cat("{green-fg}DONE!{/}");
		cli.log(">initialiazing database... ")
		return new Promise((resolve, reject) => {
			dbInit(DATABASE)
			.then(db => {
				cli.cat("{green-fg}DONE!{/}");
				resolve({
					key: k,
					database: db
				});
			})
			.catch(reject);
		});
	})
	.then(({key: k, database: db }) => {
		cli.log(">initializing discord client...");
		return new Promise((resolve, reject) => {
			clientInit(API_TOKEN, fs, cli, Client)
			.then(client => {
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
	.then(({key: k, database: db, client: client }) => {
		return new Promise((resolve, reject) => {
			cli.select(ChannelSelect(cli, db, client))
			.then((channel_id) => {
				cli.log(">attempting to connect to target channel... ");
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
		cli.destroy();
		cli = new SingleCLI(SCREEN_TITLE, '{bold}[Ctrl-C] to quit{/bold}', `${channel.guild.name} {green-fg}#${channel.name}{/}`, client.user.tag);
		stowaway.on('message', model.message);
		stowaway.on('error', (err) => { cli.error(err); });
		stowaway.on('timestamp', (ts, id) => { model.timestamp(ts, id); });
		stowaway.on('failed decrypt', model.decryptionFailure);
		stowaway.on('notify', (message) => { cli.notify(message); });
		stowaway.on('debug', (message) => { cli.warning(`DEBUG: ${message}`); });
		stowaway.on('channel delete', () => { cli.error(`${channel.name} deleted!`); });
		stowaway.on('channel update', (ch) => {
			cli.notify("channel updated!")
			cli.channelLabel = ch.name;
			cli.render();
		});
		stowaway.on('bad handshake', (user) => {
			cli.warning(`BAD HANDSHAKE from ${user.tag}`);
		});
		stowaway.on('handshake', (user) => {
			cli.handshake(`HANDSHAKE from ${user.tag}`);
		});
		model.on('update', () => {
			cli.messages = model.text;
			cli.render();
		});
		stowaway.launch(client);
		stowaway.on('message', (ts, date, author, content) => {
			cli.encrypted(`new message from ${author.tag}`);
		});
		cli.messages = model.text;
		const fsm = new FSMBuilder()
		.enterRead(() => {
			cli.stateBG = 'magenta';
			cli.stateText = 'READING -- [SPACE] begin writing; [W] scroll up/fetch older messages; [S] scroll down/fetch newer messages';
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
		fsm.on('send input', () => {
			stowaway.encrypt(cli.submitInput());
		});
		fsm.on('clear input', () => {
			cli.cancelInput();
		});
		const fetchOlder = function () {
			stowaway.fetchOlder(model.oldest)
			.then(() => { cli.notify("fetched older messages!"); })
		}
		const fetchNewer = function () {
			stowaway.fetchNewer(model.newest)
			.then(() => { cli.notify("fetched newer messages!"); })
		}
		fsm.on('scroll', (offset) => {
			cli.scrollChannel(offset);
			if (cli.channelHeight >= cli.channelScrollHeight) {
				if (offset > 0) {
					fetchNewer();
				}
				else if (offset < 0) {
					fetchOlder();
				}
			}
			else {
				if (cli.channelScrollPerc === 0) {
					fetchOlder();
				}
				else if (cli.channelScrollPerc === 100) {
					fetchNewer();
				}
			}
		});
	})
	.catch(err => {
		cli.destroy();
		console.error(err);
		console.log("Pass --help to see usage information");
		console.log("[Ctrl-C] to quit");
	});
}
