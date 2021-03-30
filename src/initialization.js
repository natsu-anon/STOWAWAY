const fs = require('fs');
const process = require('process');
const { Client } = require('discord.js');

const InitCLI = require('./init-cli.js');
const dbInit = require('./database.js');
const clientInit = require('./client.js');
const keyInit = require('./key.js');
const Stowaway = require('./stowaway.js');

const WARNING = `
{black-fg}{yellow-bg}## {underline}WARNING{/underline} ##########################################{/}
{black-fg}{yellow-bg}#                                                   #{/}
{black-fg}{yellow-bg}#  ENSURE YOUR EXECUTABLE/SOURCE CODE IS FROM:      #{/}
{black-fg}{yellow-bg}#  {underline}github.com/natsu-anon/STOWAWAY{/underline}                   #{/}
{black-fg}{yellow-bg}#  DO NOT SHARE stowaway.db WITH ANYONE.            #{/}
{black-fg}{yellow-bg}#  DO NOT SHARE stowaway.key WITH ANYONE.           #{/}
{black-fg}{yellow-bg}#  DO NOT SHARE stowaway.token WITH ANYONE.         #{/}
{black-fg}{yellow-bg}#  DO NOT SHARE stowaway.revoke WITH ANYONE.        #{/}
{black-fg}{yellow-bg}#                                                   #{/}
{black-fg}{yellow-bg}#  DO NOT TRUST THE GOVERNMENT.                     #{/}
{black-fg}{yellow-bg}#  DO NOT TRUST CORPORATIONS & COMPANIES.           #{/}
{black-fg}{yellow-bg}#  {underline}DO NOT TRUST GROOMERS.{/underline}                           #{/}
{black-fg}{yellow-bg}#                                                   #{/}
{black-fg}{yellow-bg}#  THIS SOFTWARE DOES NOT WORK AGAINST KEYLOGGERS.  #{/}
{black-fg}{yellow-bg}#  - NOR -                                          #{/}
{black-fg}{yellow-bg}#  {underline}PEOPLE STANDING BEHIND YOU.{/underline}                      #{/}
{black-fg}{yellow-bg}#                                                   #{/}
{black-fg}{yellow-bg}#####################################################{/}
\n`;

/* LANCH PROCEDURE:
 * 1. VERSION CHECK
 *		- if not up to date: notify user:
 *		a) most recent version
 *		b) where to download most recent version
 *		c) HOW to update (just drag in the new binary)
 * 2. DB INITIALIZATION
 * 3. CLIENT LOGIN (but not hooked up to stowaway and all that)
 *		- if no API token found request then save it
 * 4. PGP KEY GEN LOGIN
 *		- if no key found ask user for passphrase (MAKE SURE THEY ENTER IT TWICE)
 *		- warn them that if they forget their password they will NOT be able to recover it and MUST revoke their key
 *		- if they put in the wrong passphrase three times enter the revoke sequence & generate a new key
 * 5. STOWAWAY
*/
function init (BANNER, SCREEN_TITLE, DATABASE, API_TOKEN, PRIVATE_KEY, VERSION, REVOCATION_CERTIFICATE, versionText) {
	return new Promise((resolve, reject) => {
		const cli = new InitCLI(BANNER, SCREEN_TITLE, process);
		(versionText != null ? cli.pauseLog(versionText) : Promise.resolve())
		.then(() => {
			cli.log(WARNING);
			cli.log('>initializing database... ');
			return dbInit(DATABASE);
		})
		.then(db => {
			cli.cat('{green-fg}DONE!{/}');
			cli.log('>initializing discord client... ');
			return new Promise(res => {
				clientInit(API_TOKEN, fs, cli, Client)
				.then(client => {
					client.user.setStatus('dnd');
					cli.cat('{green-fg}DONE!{/}');
					cli.log(`>logged in as {green-fg}{underline}${client.user.tag}{/}`);
					res({ db, client });
				})
				.catch(err => {
					cli.destroy();
					reject(err);
				});
			});
		})
		.then(({ db, client }) => {
			cli.log('>initializing PGP key... ');
			const stowaway = new Stowaway(db, PRIVATE_KEY, VERSION);
			return new Promise(res => {
				keyInit(PRIVATE_KEY, REVOCATION_CERTIFICATE, stowaway, client, cli)
				.then(key => { // key is decrypted
					cli.cat('{green-fg}DONE!{/}');
					cli.log('>{black-fg}{green-bg}STOWING AWAY!{/}');
					setTimeout(() => {
						cli.destroy();
						res({ stowaway, client, key, db });
					}, 500);
				})
				.catch(err => {
					cli.destroy();
					reject(err);
				});
			});
		})
		.then(resolve)
		.catch(err => {
			cli.destroy();
			reject(err);
		});
	});
}

module.exports = init;
