const fs = require('fs');
const openpgp = require('openpgp');
const process = require('process');
const readline = require('readline');
const { Client } = require('discord.js');

// create an console interface
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});


function prepClient ({ database: db, key: key }) {
	/* Client events to subscribe to:
	*  N E C E S S A R Y
	*    guildCreate -
	*    message -
	*
	*  Nice to have
	*    error - for debugging & error logging
	*    invalidated
	*    channelCreate
	*    channelDelete
	*    channelUpdate
	*    guildBanAdd
	*    guildBanRemove
	*    guildDelete -
	*    guildMemberAdd
	*    guildMemberRemove
	*    guildMemberUpdate
	*    guildUnavailable
	*    guildUpdate
	*    messageUpdate
	*    presenceUpdate
	*    userUpdate
	*/
	return (client) => {
		return client;
	};
}

require('./database.js').Init(rl, openpgp)
.then((data) => {
	return new Promise((resolve, reject) => {
		require('./client.js').Login(fs, Client, prepClient(data))
		.then((client) => {
			data.client = client
			resolve(data);
		})
		.catch(reject);
	});
})
.then(({key: key, database: db, client: client}) =>  {
	console.log(`logged in as ${client.user.tag}\tid: ${client.user.id}`);
	client.guilds.cache.each((guild) => {
		console.log(`${guild.name}`);
		guild.channels.cache.each((channel) => { console.log(`- \x1b[32m${channel.type}\x1b[0m ${channel.name}`) });
	});
	client.guilds.cache.each((guild) => {
		console.log(`${guild.name}`);
		guild.channels.cache.filter(channel => channel.isText())
		.each(channel => console.log(`- \x1b[32m${channel.parent}\x1b[0m ${channel.name}`));
	});
	client.destroy()

})
.catch((err) => { console.error(err); });
