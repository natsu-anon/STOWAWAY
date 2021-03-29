const fs = require('fs');
const process = require('process');
const { Client } = require('discord.js');
const versionCheck = require('./version-check.js');

const initialize = require('./initialization.js');

const SingleCLI = require('./single-cli.js');
const { FSMBuilder } = require('./state_machine/builder.js');

// NOTE update url to use main branch
const VERSION_URL = 'https://raw.githubusercontent.com/natsu-anon/STOWAWAY/development/version.json';
const SCREEN_TITLE = 'ＳＴＯＷＡＷＡＹ';

function main (VERSION, BANNER, DATABASE, API_TOKEN, PRIVATE_KEY, REVOCATION_CERTIFICATE) {
	let cli;
	versionCheck(VERSION_URL, VERSION)
	.then(result => {
		return initialize(BANNER, SCREEN_TITLE, DATABASE, API_TOKEN, PRIVATE_KEY, VERSION, REVOCATION_CERTIFICATE, result);
	})
	.then(({ stowaway, client, key }) => {
		console.log('TODO MAIN');
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
