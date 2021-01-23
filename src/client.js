const tokenFile = './token DO NOT SHARE';

function login (fs, prepClient) {
	return new Promise((resolve, reject) => {
		fs.readFile(tokenFile, 'utf8', (readErr, data) => {
			if (readErr == null) {
				clientLogin(data, prepClient)
					.then((client) => {
						resolve(client);
					})
					.catch((err) => {
						badtoken();
					});
			}
			else if (rErr.code === 'ENOENT') {
				const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
				rl.question("No token found.  Enter discord bot token:\n>", (token) => {
					fs.writeFile(tokenFile, token, 'utf8', (writeErr) => {
						if (wErr == null) {
							clientLogin(token)
								.then((client) => {
									resolve(client);
								})
								.catch((err) => {
								console.log(`"${token}"`);
									badtoken();
								});
						}
						else { // failed to write to file
							reject(writeErr);
						}
					})
				});
			}
			else { // unexpected error
				reject(readErr);
			}
		});
	});
}

function clientLogin (token, prepClient) {
	const discord = require('discord.js');
	console.log("attempting to login to discord with supplied token");
	return new Promise((resolve, reject) => {
		// NOTE don't style on loodi
		const client = prepClient(new discord.Client());
		client.login(token)
			.then(() => { resolve(client); })
			.catch(reject);
	});
}

function badtoken() {
	console.error(`\x1b[31mFailed to login with token.  Check file "${tokenFile}" to make sure your token is correct & that you are connected to the internet\x1b[0m`);
}

module.exports = {
	Login : (fs, prepClient) => {
		return login(fs, prepClient);
	}
}
