function prepare (client) {
	// TODO hook into 'guildCreate',emitted whenever the client joins a guild
	// TODO hook into 'message', emitted whenever a message is created
	return client;
}

class SingletonClient  {
	// NOTE: SingletonClient.instance is a discord.js Client
	// https://discord.js.org/#/docs/main/master/class/Client
	constructor (token, verbose) {
		if (SingletonClient.exists) {
			return SingletonClient.instance;
		}
		else {
			const discord = require('discord.js');
			// assume config set up properly, TODO handle if it's not LATER
			SingletonClient.exists = true;
			SingletonClient.instance = new discord.Client();
			SingletonClient.connected = false;
			if (verbose) {
				SingletonClient.instance.once('ready', () => {
					console.log(`Logged in as ${SingletonClient.instance.user.tag}!`);
				});
			}
			SingletonClient.instance.on('ready', () => {
				SingletonClient.instance.connected = true;
			});
			SingletonClient.instance.on('invalidated', () => {
				SingletonClient.instance.connected = false;
			});
			SingletonClient.instance.on('error', (err) => {
				console.error("ERROR", err);
			});
			SingletonClient.instance.loginOnce = () => {
				SingletonClient.instance.loginOnce = () => {};
				SingletonClient.instance.login(token);
			};
			return prepare(SingletonClient.instance);
		}
	}
}

module.exports = {
	Client: (token, verbose=false) => {
		return new SingletonClient(token);
	},
}
