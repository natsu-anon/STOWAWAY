const fs = require("fs");
const process = require("process");
const discord = require("discord.js");

const token = fs.readFileSync("./token", 'utf8');

const client = new discord.Client();
client.on("ready", () => {
	console.log("ready");
	process.exit()
});

client.login(token)
	.then(() => { console.log("logged in!"); })
	.catch((err) => {
		console.error(`failed to login with token: ${token}`);
		console.error(err);
	});
