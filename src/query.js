const fs = require('fs');
const { Client } = require('discord.js');
const API_TOKEN = './token DO NOT SHARE';


return new Promise((resolve, reject) => {
	const client = new Client();
	client.once('ready', () => {
		resolve(client);
	});
	fs.readFile(API_TOKEN, 'utf8', (err, data) => {
		if (err) {
			reject(err);
		}
		else {
			client.login(data);
		}
	});
})
.then(client =>  {
	console.log(`logged in as ${client.user.tag}\tid: ${client.user.id}`);
	client.guilds.cache.each((guild) => {
		guild.channels.cache.filter(channel => channel.isText())
		.each(channel => {
			console.log(channel.name);
			console.log(`\tcan view: ${channel.permissionsFor(client.user).has('VIEW_CHANNEL')}`);
			console.log(`\tcan message: ${channel.permissionsFor(client.user).has('SEND_MESSAGES')}`);
			console.log(`\tread history: ${channel.permissionsFor(client.user).has('READ_MESSAGE_HISTORY')}`);
		});
	});
	client.destroy()
	process.exit(0)
})
.catch((err) => { console.error(err); });
