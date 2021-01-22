const tokenFile = './token DO NOT SHARE';

function login (fs, database, prepClient) {
	return new Promise((resolve, reject) => {
		fs.readFile(tokenFile, 'utf8', (rErr, data) => {
			if (rErr == null) {
				client_login(data, prepClient)
					.then((client) => {
						resolve({ database: database, client: client })
					})
					.catch((err) => {
						badtoken();
					});
			}
			else if (rErr.code === 'ENOENT') {
				const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
				rl.question("No token found.  Enter discord bot token:\n>", (token) => {
					fs.writeFile(tokenFile, token, 'utf8', (wErr) => {
						if (wErr == null) {
							client_login(token)
								.then((client) => {
									resolve({database: database, client: client })
								})
								.catch((err) => {
								console.log(`"${token}"`);
									badtoken();
								});
						}
						else { // failed to write to file
							reject(wErr);
						}
					})
				});
			}
			else { // unexpected error
				reject(rErr);
			}
		});
	});
}

function client_login (token, prepClient) {
	const discord = require('discord.js');
	return new Promise((resolve, reject) => {
		const client = prepClient(new discord.Client());
		client.login(token)
			.then(() => { resolve(client); })
			.catch(reject);
	});
}

function badtoken() {
	console.error(`\x1b[31mFailed to login with token.  Check file "${tokenFile}" to make sure your token is correct\x1b[0m`);
}

module.exports = {
	Login : (fs, database, prepClient) => {
		return login(fs, database, prepClient);
	}
}
