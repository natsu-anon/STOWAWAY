const fs = require('fs');
const { login } = require('./client.js');
const process = require('process');

function log (text, pad=0) {
	console.log(text.padStart(text.length + pad));
}

module.exports = (tokenPath) => {
	login(tokenPath)
	.then(client => {
		console.log(`logged in as ${client.user.tag}`);
		let info = 'In order for a server channel to be usable by STOWAWAY your bot must be able to:\n';
		info += '  1. view the channel\n';
		info += '  2. send messages to the channel\n';
		info += '  3. read the message history of the channel\n';
		info += `Servers ${client.user.tag} has been added to will appear \x1b[4munderlined\x1b[0m\n`;
		info += 'Available channels will appear in \x1b[42m\x1b[30mgreen\x1b[0m\n';
		info += 'Unavailable channels will appear in \x1b[31mred\x1b[0m along with what permissions your bot lacks';
		console.log(info);
		client.guilds.cache.each(guild => {
			console.log(`\n\x1b[4m${guild.name}\x1b[0m`);
			guild.channels.cache.filter(channel => channel.isText())
			.each(channel => {
				const permissions = channel.permissionsFor(client.user);
				const viewFlag = permissions.has('VIEW_CHANNEL');
				const sendFlag = permissions.has('SEND_MESSAGES');
				const historyFlag = permissions.has('READ_MESSAGE_HISTORY');
				if (viewFlag && sendFlag && historyFlag) {
					console.log(`  \x1b[42m\x1b[30m#${channel.name}\x1b[0m`);
				}
				else {
					console.log(`  \x1b[31m#${channel.name}\x1b[0m`);
				}
				if (!viewFlag) {
					log('- cannot view', 4);
				}
				if (!sendFlag) {
					log('- cannot send messages', 4);
				}
				if (!historyFlag) {
					log('- cannot read message history', 4);
				}
			});
		});
		client.destroy();
		process.exit(0);
	})
	.catch(err => {
		console.error(err);
		process.exit(2);
	});
};
