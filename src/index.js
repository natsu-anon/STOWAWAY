const fs = require('fs');
const process = require('process');
const { Client } = require('discord.js');

const dbInit = require('./database.js');
const keyInit = require('./key.js');
const clientInit = require('./client.js');

const SingleChannel = require('./models/single-channel.js');
const { SingleStowaway, PlaintextStowaway } = require('./single-stowaway.js');
const InitCLI = require('./init-cli.js');
const SingleCLI = require('./single-cli.js');
const { FSMBuilder } = require('./state_machine/builder.js');

const SCREEN_TITLE = 'ＳＴＯＷＡＷＡＹ v0.2.0';
const DATABASE = './stowaway.db';
const PRIVATE_KEY = './stowaway.key';
const API_TOKEN = './token DO NOT SHARE';
const SC_TARGET = './channel_id.txt';
// const REVOCATION_CERT = './stowaway.cert';


const warning = `
{black-fg}{yellow-bg} ################################################## {/}
{black-fg}{yellow-bg} #    DO NOT SHARE YOUR API TOKEN WITH ANYONE.    # {/}
{black-fg}{yellow-bg} #    DO NOT SHARE stowaway.db WITH ANYONE.       # {/}
{black-fg}{yellow-bg} #    DO NOT SHARE stowaway.key WITH ANYONE.      # {/}
{black-fg}{yellow-bg} ################################################## {/}
\n`;


let cli = new InitCLI(SCREEN_TITLE);
const channelPromise = new Promise((resolve, reject) => {
	if (process.argv.length == 3) {
		resolve(process.argv[2]);
	}
	else {
		fs.readFile(SC_TARGET, 'utf8', (err, data) => {
			if (err) {
				reject(Error("STOWAWAY v0.2.0 requires either target channel id to be passed as a command line argument -OR- channel_id.txt with target channel id"));
			}
			else {
				resolve(data);
			}
		});
	}
});
cli.log(warning);
cli.log(">intiliazing pgp keys... ");
keyInit(PRIVATE_KEY, fs, cli)
.then(k => {
	cli.cat("{green-fg}DONE!{/}");
	cli.log(">initialiazing nedb database... ")
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
			cli.log(`>{black-fg}{green-bg}Logged in as ${client.user.tag}{/}`);
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
	cli.log(">attempting to connect to target channel... ");
	return new Promise((resolve, reject) => {
		channelPromise
		.then(channelID => {
			client.channels.fetch(channelID)
			.then(channel => {
				cli.cat(`{green-fg}DONE!{/}`);
				cli.log(`>{black-fg}{green-bg}Channel: ${channel.name}{/}`);
				resolve({
					key: k,
					database: db,
					client: client,
					channel: channel
				});
			})
			.catch(err => {
				client.destroy();
				reject(err);
			});
		})
		.catch(err => {
			client.destroy();
			reject(err);
		});
	});
})
.then(({ key: key, database: db, client: client, channel: channel }) => {
	const stowaway = new SingleStowaway(key, channel, db);
	const model = new SingleChannel();
	cli.destroy();
	cli = new SingleCLI(SCREEN_TITLE, '{bold}[Ctrl-C] to quit{/bold}', channel.name, client.user.tag);
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
	/*
	cli.screen.key(['a'], () => {
		fsm.onA();
	});
	*/
	cli.screen.key(['s'], () => {
		fsm.onS();
	});
	/*
	cli.screen.key(['d'], () => {
		fsm.onD();
	});
	*/
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
	process.exit(1);
});
