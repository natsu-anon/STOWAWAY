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
// const REVOCATION_CERT = './stowaway.cert';


const warning = `
 {black-fg}{yellow-bg} ################################################## {/}
 {black-fg}{yellow-bg} #    DO NOT SHARE YOUR API TOKEN WITH ANYONE.    # {/}
 {black-fg}{yellow-bg} #    DO NOT SHARE stowaway.db WITH ANYONE.       # {/}
 {black-fg}{yellow-bg} #    DO NOT SHARE stowaway.key WITH ANYONE.      # {/}
 {black-fg}{yellow-bg} ################################################## {/}
\n`;

if (process.argv.length != 3) {
	console.log('\x1b[31mSTOWAWAY v0.2.0 requires 1 argument: target channel id\x1b[0m');
	process.exit(1);
}


let cli = new InitCLI(SCREEN_TITLE);
cli.log(warning);
keyInit(PRIVATE_KEY, fs, cli)
.then(k => {
	return new Promise((resolve, reject) => {
		dbInit(DATABASE)
		.then(db => {
			cli.log('database initialized!');
			resolve({key: k, database: db });
		})
		.catch(reject);
	});
})
.then(data => {
	return new Promise((resolve, reject) => {
		clientInit(API_TOKEN, fs, cli, Client)
		.then(client => {
			data.client = client;
			resolve(data);
		})
		.catch(reject);
	});
})
.then(res => {
	cli.log(`logged in as ${res.client.user.tag}`);
	return new Promise((resolve, reject) => {
		res.client.channels.fetch(process.argv[2])
		.then(channel => {
			res.channel = channel;
			resolve(res);
		})
		.catch(err => {
			res.client.destroy();
			reject(err);
		})
	});
})
.then(({ key: key, database: db, client: client, channel: channel }) => {
	cli.log(`channel: ${channel.name}`);
	const stowaway = new SingleStowaway(key, channel, db);
	/* ENCRYPT DEBUGGING
	stowaway.on('message', (ts, date, author, content) => { cli.log(content); });
	stowaway.on('debug', (text) => { cli.log(`{yellow-fg}${text}{/}`); });
	stowaway.on('error', (text) => { cli.log(`{red-fg}${text}{/}`); });
	stowaway.launch(client);
	setTimeout(function(text){ stowaway.encrypt(text); }, 3000, 'GIB BIG BOOBA FUJO GF PLS');
	*/
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
		cli.stateText = 'READING -- [SPACE] begin writing; [W] scroll up; [A] fetch older messages; [S] scroll down; [D] fetch newer messages';
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
	cli.screen.key(['a'], () => {
		fsm.onA();
	});
	cli.screen.key(['s'], () => {
		fsm.onS();
	});
	cli.screen.key(['d'], () => {
		fsm.onD();
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
	fsm.on('scroll', (offset) => {
		cli.scrollChannel(offset);
	});
	fsm.on('fetch', (newerFlag) => {
		if (newerFlag) {
			stowaway.fetchNewer(model.newest)
			.then(() => { cli.notify("fetched newer messages!"); })
		}
		else {
			stowaway.fetchOlder(model.oldest)
			.then(() => { cli.notify("fetched older messages!"); })
		}
	});
})
.catch(err => {
	cli.destroy();
	console.error(err);
	process.exit(1);
});
