const fs = require("fs");
const process = require("process");
const discord = require("discord.js");

const token = fs.readFileSync("./token DO NOT SHARE", 'utf8');

const client = new discord.Client();
client.on("ready", () => {
	console.log(client.user.username);
	process.exit()
});

client.login("foo")
	.then(() => { console.log("logged in!"); })
	.catch((err) => {
		console.error(`failed to login with token: ${token}`);
	});
