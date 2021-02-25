function init (tokenPath, fs, rl, Client,) {
	return new Promise((resolve, reject) => {
		fs.access(tokenPath, fs.constants.R_OK, (err) => {
			if (err == null) {
				fs.readFile(tokenPath, 'utf8', (err, data) => {
					if (err) {
						reject(err);
					}
					else {
						clientLogin(data, tokenPath, Client).then(resolve).catch(reject);
					}
				});
			}
			else {
				rl.question("No token found.  Enter discord bot token:\n>", token => {
					clientLogin(token, tokenPath, Client)
					.then((client) => {
						console.log("\x1b[1m\x1b[32mSupplied token accepted!\x1b[0m");
						console.log(token);
						fs.writeFile(tokenPath, token, 'utf8', (err) => {
							if (err) {
								reject(err);
							}
							else {
								resolve(client);
							}
						});
					})
					.catch(reject);
				});
			}
		})
	})
}

function clientLogin (token, tokenPath, Client) {
	console.log("attempting to login to discord with supplied token...");
	return new Promise((resolve, reject) => {
		const client = new Client();
		client.once('ready', () => resolve(client));
		client.login(token)
		.catch(err => {
			badtoken(tokenPath);
			reject(err);
		});
	});
}

function badtoken (tokenPath) {
	console.error(`\x1b[31mFailed to login with token.  Check file "${tokenPath}" to make sure your token is correct & that you are connected to the internet\x1b[0m`);
}

module.exports = init;
