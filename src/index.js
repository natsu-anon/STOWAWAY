const fs = require('fs');
const readline = require('readline');
const process = require('process');
const { Client } = require('discord.js');

const dbInit = require('./database.js');
const keyInit = require('./key.js');
const clientInit = require('./client.js');

const SingleChannel = require('./models/single-channel.js');
const { SingleStowaway, PlaintextStowaway } = require('./single-stowaway.js');
const SingleCLI = require('./single-cli.js');
const { FSMBuilder } = require('./state_machine/builder.js');

const DATABASE = './stowaway.db';
const PRIVATE_KEY = './stowaway.key';
const API_TOKEN = './token DO NOT SHARE';
// const REVOCATION_CERT = './stowaway.cert';


const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	prompt: '>',
});
rl.pause();

console.log(fs.readFileSync('./banner.txt', 'utf8'));

function warn () {
	console.log(`\x1b[33m
#########################################################
# DO NOT SHARE YOUR API TOKEN WITH ANYONE               #
# DO NOT SHARE stowaway.db WITH ANYONE.                 #
# DO NOT SHARE stowaway.key WITH ANYONE.                #
#########################################################
\x1b[0m`);
}

if (process.argv.length != 3) {
	console.log('\x1b[31mSTOWAWAYv0.2.0 requires 1 argument: target channel id\x1b[0m');
	process.exit(1);
}

warn();

keyInit(PRIVATE_KEY, fs, rl)
.then(k => {
	return new Promise((resolve, reject) => {
		dbInit(DATABASE)
		.then(db => resolve({key: k, database: db }))
		.catch(reject);
	});
})
.then(data => {
	return new Promise((resolve, reject) => {
		clientInit(API_TOKEN, fs, rl, Client)
		.then(client => {
			data.client = client;
			resolve(data);
		})
		.catch(reject);
	});
})
.then(res => {
	rl.close();
	console.log(`logged in as ${res.client.user.tag}`);
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
	console.log(`channel: ${channel.name}`);
	const stowaway = new PlaintextStowaway(client, db, channel);
	const ch_model = new SingleChannel();
	const log = [];
	const cli = new SingleCLI(client.user.tag, channel.name);
	stowaway.on('message', ch_model.receive);
	ch_model.on('update', () => {
		cli.messages = ch_model.tex;
		cli.render();
	});
	stowaway.launch();
	cli.messages = ch_model.text;
	// cli.render();
	// setTimeout(function (text, type){ cli.notify(text, type); }, 200, "HENLO", "encrypted");
	const fsm = new FSMBuilder()
	.enterRead(() => {
		log.push("enter read");
		cli.messages = log.join('\n');
		cli.render();
		/*
		// cli.notify("READ STATE", "encrypted");
		cli.channelBox.border = { type: 'line', fg: 'green' };
		cli.render();
		*/
	})
	.exitRead(() => {
		log.push("exit read");
		cli.messages = log.join('\n');
		cli.render();
		/*
		cli.channelBox.border = { type: 'line' };
		*/
	})
	.enterWrite(() => {
		if (!cli.inputBox.focused) {
			log.push("enter write");
			cli.render();
			// cli.notify("WRITE STATE", "handshake");
			cli.inputBox.setLabel("{green-fg}writing...{/}")
			cli.inputBox.border = { type: 'line', fg: 'green' };
			// cli.focusInput();
			// cli.screen.focusPush(cli.inputBox);
			cli.screen.focused = null;
			cli.screen.focused = cli.inputBox;
			// log.push(cli.screen.focused);
			cli.messages = log.join('\n');
			// cli.inputBox.focus();
			// cli.channelBox.focus();
			cli.render();
		}
	})
	.exitWrite(() => {
		log.push("exit write");
		cli.messages = log.join('\n');
		cli.render();
		cli.inputBox.setLabel("yadda yadda");
		cli.inputBox.border = { type: 'line' };
		cli.inputBox.submit();
		cli.screen.focusPop();
		// cli.channelBox.focus();
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
	cli.screen.key(['tab'], () => {
		fsm.onTab();
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
	cli.inputBox.key(['tab'], () => {
		fsm.onTab();
	});
	fsm.on('send input', () => {
		cli.notify(cli.submitInput());
	});
	process.stdin.on('keypress', (c, k) => {
		log.push(`KEYPRESS: c: ${c}, k:${k}`);
		cli.messages = log.join('\n');
		cli.render();
	});
	/*
	fsm.on('scroll up', () => {
		cli.scroll(1);
	});
	fsm.on('scroll down', () => {
		cli.scroll(-1);
	});
	*/
	// cli.screen.focus();
	/*
	cli.screen.key(['w'], () => {
		fsm.onW();
	});
	cli.screen.key(['s'], () => {
		fsm.onS();
	});
	*/
	/*
	const cli = new SingleCLI(client.user.tag, channel.name);
	// other stowaway event handling
	const fsm = new FSMBuilder()
	fsm.on('clear input', cli.cancelInput);
	fsm.on('pause input', cli.pauseInput);
	fsm.on('send input', () => {
		stowaway.encrypt(cli.submitInput());
	});
	cli.screen.key(['C-c'], () => {
		client.destroy();
		return process.exit(0);
		// fsm.onCtrlC();
	});
	cli.channelContent(ch_model.text());
	ch_model.on('update', () => {
		cli.channelContent(ch_model.text());
	});
	*/
	// client.destroy();
	// process.exit(0);
})
.catch(err => {
	console.error(err);
	// process.exit(1);
});
