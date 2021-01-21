# STOWAWAY
Thanks for the free network.

### INSTALL NODE.JS
[choose the LTS (current version 14.15.4 LTS)](https://nodejs.org/en/)

### Discord Bot
Make your own [discord bot](https://discord.com/developers/docs/intro#bots-and-apps), then save its token (NOT client secret) to a file named token (make sure its copy pasted properly)

## REFERENCES
- [Regular Expressions in javasvcript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions)
- [discord.js docs](https://discord.js.org/#/docs/main/stable/general/welcome)
- [nedb api](https://github.com/louischatriot/nedb/#api)

## END-TO-END ENCRYPTION LAYER FOR DISCORD VIA BOTS.  THINK ABOUT IT.
- [PGP FAQ](http://www.pgp.net/pgpnet/pgp-faq/pgp-faq.html)
- use node to run filthy javascript -- sorry, Terry.
- [OpenPGP.js](https://github.com/openpgpjs/openpgpjs) for encryption
```
npm install --save openpgp
```
- [NeDB](https://github.com/louischatriot/nedb/) for database
```
npm install nedb --save
```
- [discord.js](https://github.com/discordjs/discord.js) for dat dere discord api
```
npm install discord.js // no voice support
```
- [blessed](https://github.com/chjj/blessed) curses-like library for node.js
```
npm install blessed
```
- [nexe](https://github.com/nexe/nexe) compile node.js app to a single executable file
```
npm i nexe -g
```

### NOTA BENE
- lmao hash discord snowflakes -- don't use channel/user ids when querying about people via comms

__vim development__
- use `! your-command` to run commands from within vim
- use `! start your-command` to do it ASYNCHRONOUSLY (opens up a new terminal)

__javascript__
- [oh hey this video is pretty nice, javascript sure changed a lot.](https://www.youtube.com/watch?v=Mus_vwhTCq0)
- use `myVariable == null` to test if a variable is undefined OR null.
- javascript does not overload functions :C
- javascript variables
	- `var` is globally scoped & initialized to undefined.  GROCE.
	- `let` is scope blocked.  Not initialized.
	- `const` is _also_ scope blocked.  Cannot be updated/redecalred.
		- __MUST__ be initialized at time of declaration.
- ~~[Promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)~~
[`async` & `await`](https://youtu.be/Mus_vwhTCq0?t=619) instead.
- backticks \` format variables using `${varName}`

__inviting non-public bots__
- go to `https://discord.com/oauth2/authorize?client_id=APPLICATION_CLIENT_ID&scope=bot&permissions=3072`, add to the server desired
