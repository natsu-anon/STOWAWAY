module.exports = function(banner) {
	console.log(banner);
	let about = '\nSTOWAWAY is an End-to-End PGP encryption layer for Discord focused on making privacy easy & accessible via bots.\n';
	about += 'Layed out plainly:\n';
	about += '  1. Your computer encrypts your message\n';
	about += '  2. Your bot sends the encrypted message over the network\n';
	about += "  3. The recipient's bot receives the encrypted message\n";
	about += "  4. The recipient's computer decrypts the message\n";
	about += 'Meaning the network only sees encrypted messages, but you just read & write plaintext!\n';
	about += "Currently STOWAWAY also features an automatic handshake protocol that exchanges and saves public keys, so you don't have to!\n\n";
	about += 'STOWAWAY is currently under active development, with many features planned out for the future.\n';
	about += 'The official github repo is: \x1b[4mhttps://github.com/natsu-anon/STOWAWAY\x1b[0m\n';
	about += 'That page includes instructions on how to setup a Discord bot & add it to servers with pictures & step-by-step instructions.\n\n';
	about += 'To learn more about the WTFPL that STOWAWAY is licensed under see: \x1b[4mhttp://www.wtfpl.net/\x1b[0m\n\n';
	about += 'Thanks for downloading & I hope you find this software useful';
	about += '<3';
	console.log(about);
};
