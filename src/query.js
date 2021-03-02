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
	/*
	foo = {}
	client.guilds.cache.each((guild) => {
		console.log(`[-] ${guild.name}`);
		guild.channels.cache.filter(channel => channel.isText())
		.each((channel) => {
			if (channel.parent == null) {
				console.log(`  > ${channel.name}`);
			}
			else {
				if (channel.parentID in foo) {
					foo[channel.parentID].push(channel.name);
				}
				else {
					foo[channel.parentID] = [ channel.name ];
				}
			}
		});
		let channel;
		for (let id in foo) {
			channel = guild.channels.cache.find(channel => channel.id == id)
			console.log(`  [-] \x1b[32m${channel.name}\x1b[0m`);
			for (let i = 0; i < foo[id].length; i++) {
			// for (let foo in categories[id]) {
				console.log(`    > ${foo[id][i]}`);
			}
		}
	});
	client.destroy()
	process.exit(0)
	*/
})
.catch((err) => { console.error(err); });
