# STOWAWAY
Thanks for the free network.

how to run javascript in a console:
1. open up a console in repository folder
2. run `node .\path\to\source_file_you_want.js`
3. simple as

### INSTALL NODE.JS
[choose the LTS (current version 14.15.4 LTS)](https://nodejs.org/en/)

### Discord Bot
Make your own [discord bot](https://discord.com/developers/docs/intro#bots-and-apps), then save its token (NOT client secret) to a file named token (make sure its copy pasted properly)

## REFERENCES
- [Regular Expressions in javasvcript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions)
- [discord.js docs](https://discord.js.org/#/docs/main/stable/general/welcome)
- [OpenPGP.js documentations](https://openpgpjs.org/openpgpjs/doc/)
- [nedb api](https://github.com/louischatriot/nedb/#api)
- [blessed api](https://github.com/chjj/blessed#documentation)

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
>NOTE: Currently there is no `mouse` or `resize` event support on Windows
```
npm install blessed
```
- [pkg](https://github.com/vercel/pkg) compile node.js app to a single executable file
```
npm i pkg -g
```

### NOTA BENE
- use `cmd` to run `pkg` -- powershell won't allow it & command prompt is simpler than powershell's changing execution policy.
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
