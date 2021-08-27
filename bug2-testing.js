const process = require('process');
const { Permissions } = require('./src/stowaway.js');
const { login } = require('./src/client.js');

login('./testing/bug2-test.token')
	.then(async (client) => {
		process.on('SIGHUP', () => { client.destroy(); });
		const invite = await client.generateInvite({
			permissions: [
				'VIEW_CHANNEL',
				'SEND_MESSAGES',
				'READ_MESSAGE_HISTORY',
				'CHANGE_NICKNAME'
			]
		});
		const user = client.user;
		console.log(`\ninvite ${invite}\n`);
		// TEST guildCreate, guildDestroy, guildUpdate, channelCreate, channelUpdate, channelDestroy
		client.on('guildCreate', guild => {
			console.log(`created guild ${guild.id}: ${guild.name}`);
			guild.channels.cache.each(channel => {
				if (channel.isText()) {
					console.log(`\t${channel.id}: ${channel.name}`);
					console.log(Permissions(channel, user));
				}
			});
		});
		client.on('guildUpdate', (guild0, guild1) => {
			console.log(`updated guild ${guild0.id}: ${guild0.name}`);
			console.log(`now ${guild1.id}: ${guild1.name}`);
			guild1.channels.cache.each(channel => {
				if (channel.isText()) {
					console.log(`\t${channel.id}: ${channel.name}`);
					console.log(Permissions(channel, user));
				}
			});
		});
		client.on('guildDelete', guild => {
			console.log(`deleted guild ${guild.id}: ${guild.name}`);
		});
		client.on('channelCreate', channel => {
			console.log(`created channel ${channel.id}: ${channel.name}`);
			if (channel.isText()) {
				console.log(Permissions(channel, user));
			}
		});
		client.on('channelUpdate', (ch0, ch1) => {
			console.log(`updated channel ${ch0.id}: ${ch0.name}`);
			console.log(`now ${ch1.id}: ${ch1.name}`);
			if (ch0.isText() && ch1.isText()) {
				console.log(Permissions(ch1, user));
			}
		});
		client.on('channelDelete', channel => {
			console.log(`deleted channel ${channel.id}: ${channel.name}`);
		});
	})
	.catch(err => {
		console.error(err);
	});


/* NOTES
   1. inviting to a guild doesn't trigger channelCreate for existing channels
   2. creating a new channel DOES trigger channelCreate
   3. updating a channel keeps the channel id
   4. updating a guild keeps the id also
*/
