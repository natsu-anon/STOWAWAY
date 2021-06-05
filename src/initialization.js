const process = require('process');
const InitCLI = require('./init-cli.js');
const dbInit = require('./database.js');
const { mkdir } = require('./utils.js');
const { initialization: clientInit, clientLogin } = require('./client.js');
const keyInit = require('./key.js');
const { Stowaway } = require('./stowaway.js');
const EventEmitter = require('events');

const WARNING = `
	{black-fg}{yellow-bg}## {underline}WARNING{/underline} ##########################################{/}
	{black-fg}{yellow-bg}#                                                   #{/}
	{black-fg}{yellow-bg}#  THIS SOFTWARE DOES NOT WORK AGAINST KEYLOGGERS.  #{/}
	{black-fg}{yellow-bg}#  - NOR -                                          #{/}
	{black-fg}{yellow-bg}#  {underline}PEOPLE STANDING BEHIND YOU.{/underline}                      #{/}
	{black-fg}{yellow-bg}#                                                   #{/}
	{black-fg}{yellow-bg}#  ENSURE YOUR EXECUTABLE/SOURCE CODE IS FROM:      #{/}
	{black-fg}{yellow-bg}#  {underline}github.com/natsu-anon/STOWAWAY{/underline}                   #{/}
	{black-fg}{yellow-bg}#  DO NOT SHARE stowaway.db WITH ANYONE.            #{/}
	{black-fg}{yellow-bg}#  DO NOT SHARE stowaway.key WITH ANYONE.           #{/}
	{black-fg}{yellow-bg}#  DO NOT SHARE stowaway.token WITH ANYONE.         #{/}
	{black-fg}{yellow-bg}#  DO NOT SHARE stowaway.revoke WITH ANYONE.        #{/}
	{black-fg}{yellow-bg}#                                                   #{/}
	{black-fg}{red-bg}#  SPILL NOT BLOOD FOR THE PETRODOLLAR.             #{/}
	{black-fg}{yellow-bg}#                                                   #{/}
	{black-fg}{yellow-bg}#  DO NOT TRUST THE GOVERNMENT.                     #{/}
	{black-fg}{yellow-bg}#  DO NOT TRUST CORPORATIONS NOR COMPANIES.         #{/}
	{black-fg}{yellow-bg}#  {underline}DO NOT TRUST GROOMERS.{/underline}                           #{/}
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

function init (BANNER, SCREEN_TITLE, DATABASE, API_TOKEN, PRIVATE_KEY, VERSION, REVOCATION_CERTIFICATE, SAVE_DIR, versionText, tokenFlag) {
	const initEmitter = new EventEmitter();
	initEmitter.on('quit init', () => {
		process.exit(0);
	});
	const quitInit = () => { initEmitter.emit('quit init'); };
	const cli = new InitCLI(BANNER, SCREEN_TITLE);
	cli.screen.onceKey('C-c', quitInit);
	process.on('SIGHUP', () => { initEmitter.emit('quit init'); });
	return new Promise((resolve, reject) => {
		(versionText != null ? cli.pauseLog(versionText) : Promise.resolve())
		.then(() => mkdir(SAVE_DIR))
		.then(() => {
			cli.log(WARNING);
			cli.log('>initializing database... ');
			return new Promise((res, rej) => {
				dbInit(DATABASE) // ree package that does the indenting
				.then(({ db, channels, peers, revocations }) => {
					initEmitter.prependOnceListener('quit init', () => {
						db.close();
					});
					cli.cat('{green-fg}DONE!{/}');
					cli.log('>initializing discord client... ');
					res({ db, channels, peers, revocations });
				})
				.catch(rej);
			});
		})
		.then(({ db, channels, peers, revocations }) => {
			return new Promise((res, rej) => {
				let clientPromise;
				if (tokenFlag) {
					clientPromise = clientLogin(API_TOKEN, cli);
				}
				else {
					clientPromise = clientInit(API_TOKEN, cli);
				}
				clientPromise.then(client => {
					initEmitter.prependOnceListener('quit init', () => {
						client.destroy();
					});
					client.user.setStatus('dnd');
					cli.cat('{green-fg}DONE!{/}');
					cli.log(`>logged in as {green-fg}{underline}${client.user.tag}{/}`);
					res({ client, db, channels, peers, revocations });
				})
				.catch(rej);
			});
		})
		.then(({ client, db, channels, peers, revocations }) => {
			cli.log('>initializing PGP key... ');
			const stowaway = new Stowaway(channels, peers, revocations, PRIVATE_KEY, VERSION);
			return new Promise((res, rej) => {
				keyInit(PRIVATE_KEY, REVOCATION_CERTIFICATE, stowaway, client, cli)
				.then(({ key, passphrase }) => { // key is decrypted
					cli.cat('{green-fg}DONE!{/}');
					cli.log('{black-fg}{green-bg}>>STOWING AWAY!{/}');
					setTimeout(() => {
						cli.decouple();
						cli.screen.unkey('C-c', quitInit);
						res({ stowaway, client, key, passphrase, db, channels, peers, screen: cli.screen });
					}, 500);
				})
				.catch(rej);
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
