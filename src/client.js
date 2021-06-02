const { Client } = require('discord.js');
const { access, readFile, writeFile } = require('./utils.js');

function badtoken (tokenPath) {
	return Error(`Failed to login with token.  Check file "${tokenPath}" to make sure your token is correct & that you are connected to the internet`);
}

function init (tokenPath, cli) {
	const clientLogin = function (token) {
		const stop = cli.spin('logging in with token');
		return new Promise((resolve, reject) => {
			const client = new Client();
			client.once('ready', () => {
				stop();
				resolve(client);
			});
			client.login(token)
			.catch(() => {
				stop();
				reject(badtoken(tokenPath));
			});
		});
	};
	cli.log('\t- checking for existing discord bot token... ');
	return new Promise((resolve, reject) => {
		access(tokenPath)
		.then(() => {
			cli.cat('{green-fg}Found a token file!{/}');
			readFile(tokenPath)
			.then(data => {
				cli.log('\t- attempting to log in with existing token... ');
				clientLogin(data).then(resolve).catch(reject);
			})
			.catch(reject);
		})
		.catch(() => {
			cli.cat('{yellow-fg}No token file found{/}');
			cli.log('\t- Requesting token... ');
			cli.question.promise('Enter a discord bot token then press [ENTER] to continue', true)
			.then(token => clientLogin(token))
			.then(client => {
				return writeFile(tokenPath, client.token)
				.then(() => { resolve(client); });
			})
			.catch(reject);
		});
	});
}

function saveToken (token, tokenPath) {
	const client = new Client();
	return new Promise((resolve, reject) => {
		client.once('ready', () => {
			writeFile(tokenPath, token)
			.then(() => {
				console.log(`logged in as ${client.user.tag}\ntoken saved to ${tokenPath}`);
				client.destroy();
				resolve();
			})
			.catch(err => {
				console.error(`Error while writing the token to ${tokenPath}`);
				reject(err);
			});
		});
		client.login(token).catch(() => {
			reject(Error('Failed to login in with supplied token!  Make sure you are connected to the internet.'));
		});
	});
}

function login (tokenPath) {
	const client = new Client();
	return new Promise((resolve, reject) => {
		client.once('ready', () => {
			console.log(`logged in as ${client.user.tag}`);
			resolve(client);
		});
		readFile(tokenPath)
		.then(data => {
			console.log('attempting to log in with existing token... ');
			client.login(data).catch(() => {
				reject(badtoken(tokenPath));
			});
		})
		.catch(reject);
	});
}

module.exports = {
	login,
	initialization: init,
	token: saveToken
};
