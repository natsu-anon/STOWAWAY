function badtoken (tokenPath) {
	return Error(`Failed to login with token.  Check file "${tokenPath}" to make sure your token is correct & that you are connected to the internet`);
}

function init (tokenPath, fs, cli, Client,) {
	const clientLogin = function (token) {
		const stop = cli.spin("logging in with token");
		return new Promise((resolve, reject) => {
			const client = new Client();
			client.once('ready', () => {
				stop();
				resolve(client);
			});
			client.login(token)
			.catch(err => {
				stop();
				reject(badtoken(tokenPath));
			});
		});
	};
	return new Promise((resolve, reject) => {
		cli.log("\t- checking for existing discord bot token... ");
		fs.access(tokenPath, fs.constants.R_OK, (err) => {
			if (err == null) {
				cli.cat("{green-fg}Found a token file!{/}")
				fs.readFile(tokenPath, 'utf8', (err, data) => {
					if (err) {
						reject(err);
					}
					else {
						cli.log("\t- attempting to log in with existing... ");
						clientLogin(data).then(resolve).catch(reject);
						// clientLogin(data, tokenPath, Client).then(resolve).catch(reject);
					}
				});
			}
			else {
				cli.cat("{yellow-fg}No token file found{/}")
				cli.log("\t- Requesting token... ");
				cli.question("Enter a discord bot token then press [ENTER] to continue", true)
				.then(token => {
					return clientLogin(token);
					// return clientLogin(token, tokenPath, Client);
				})
				.then((client) => {
					// cli.log('{green-fg}Supplied token accepted!{/}');
					// console.log("\x1b[1m\x1b[32mSupplied token accepted!\x1b[0m");
					fs.writeFile(tokenPath, client.token, 'utf8', (err) => {
						if (err) {
							reject(err);
						}
						else {
							resolve(client);
						}
					});
				})
				.catch(reject);
			}
		});
	})
}

module.exports = init;
