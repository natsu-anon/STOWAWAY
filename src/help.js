module.exports = function () {
	let help = '\n  STOWAWAY [options] [passphrase]\n\n';
	help += '  Options:\n';
	help += '    -a, --about                                       \tbasic gestalt\n';
	help += '    -h, --help                                        \toutput usage information\n';
	help += '    -v, --version                                     \toutput version information\n';
	help += '    -t, --token <api_token>                           \tsupply a bot token, if it works it will be saved to "DO_NOT_SHARE\\stowaway.token"\n';
	help += '    -c, --channels                                    \tlist channel availability/inavailability with reasons why \x1b[4mNOTE: requires a valid token file\x1b[0m\n';
	help += '    -s, --servers                                     \tlist all servers your bot has been added to with ids \x1b[4mNOTE: requires a valid token file\x1b[0m\n';
	help += '    --leave-server <server_id>                        \tleave the server with the supplied id \x1b[4mNOTE: requires a valid token file\x1b[0m\n';
	help += '    --revoke <nickname> <passphrase> [revocation_path]\t';
	help += 'generate a new key with supplied nickname & password, then revoke your current key \x1b[4mNOTE: requires a valid token file\x1b[0m\n';
	help += '                                                      \t';
	help += 'If revocation_path is supplied use the revocation certificate found at that path instead of "stowaway.revoke"\n';
	help += '    --overwrite <channel_id> <message_id>             \t';
	help += 'overwrite saved public key of message author with one provided in the message \x1b[4mNOTE: requires a valid token file\x1b[0m\n';
	help += '  If you do not pass any optional flags, STOWAWAY will launch regularly.\n';
	help += '  If you pass in an optional passphrase, STOWAWAY will launch regularly and attempt to decrypt saved key with the given passphrase.\n'
	console.log(help);
};
