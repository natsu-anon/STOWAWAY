```
      _  __ __        __        __
 //  /_` / / / | | | /_/ | | | /_/ /_/  //
//  ._/ / /_/  |/|/ / /  |/|/ / /  /   //
This software is licensed under the WTFPL
```

>Arguing that **you don't care about the right to privacy because you have nothing to hide is no different than saying you don't care about free speech because you have nothing to say.**
>
> -Edward Snowden


An End-to-End PGP encryption layer for Discord focused on making privacy easy & accesible via bots [(instructions included)](#create-a-bot).
This means that the keys used to encrypt & decrypt messages are different.  The keys to encrypt are *public*, the keys to decrypt are *private* and should __NEVER__ be shared.

**NOTE ＳＴＯＷＡＷＡＹ v0.2.x & v0.3.x  currently only supports connecting to a _single server channel_ at a time, I will add support to navigate between multiple servers, channels, and direct messages SOON:tm:**

![spurdo](https://media.githubusercontent.com/media/natsu-anon/STOWAWAY/main/screenshots/spurdo.PNG)

_what you see_

![discord](https://media.githubusercontent.com/media/natsu-anon/STOWAWAY/main/screenshots/discord_view.PNG)

_what the everyone else sees_

If you're on Windows you can use [ColorTool](https://github.com/microsoft/terminal/tree/main/src/tools/ColorTool) to change your terminal's color scheme.

**Sections**
- [Setup](#setup)
	- [Installation](#installation)
	- [Create a bot](#create-a-bot)
	- [Add your bot to a server](#add-your-bot-to-a-server)
- [Usage](#usage)
- [PGP Encryption](#pgp-encryption)
- [Future Development](#future-development)
- [Donations](#donations)
- [License](#license)

## Setup
>**"If you give me six lines written by the hand of the most honest of men, I will find something in them which will hang him."**
>
>Qu'on me donne six lignes écrites de la main du plus honnête homme, j'y trouverai de quoi le faire pendre.
>
> -Cardinal Richelieu

### Installation

#### Download a binary
Just [download the latest appropriate ＳＴＯＷＡＷＡＹ](https://github.com/natsu-anon/STOWAWAY/releases/) and extract the zip file. **NOTE** I've only tested the windows binary.

#### Running from source
you can run ＳＴＯＷＡＷＡＹ from source with [Node.js](https://nodejs.org/en/)(version 14.15.4) and the following packages:
- [OpenPGP.js](https://github.com/openpgpjs/openpgpjs) version 4.10.8
- [discord.js](https://github.com/discordjs/discord.js) version 12.5.1
- [blessed](https://github.com/chjj/blessed) version 0.1.81
- [NeDB](https://github.com/louischatriot/nedb/) version 1.8.0

Once all the packages are installed you can launch ＳＴＯＷＡＷＡＹ with `npm run start [channel_id]`[(see usage for command line launch)](#usage)

### Create a Bot
If you know how to do this go ahead and skip to parts 8 and 9.
1. Go to your [developer portal](https://discord.com/developers/applications).
*Note*: if you don't have a developer account login with your discord account to automatically set up one.

![login](https://media.githubusercontent.com/media/natsu-anon/STOWAWAY/main/screenshots/bot1.PNG)

![developer portal](https://media.githubusercontent.com/media/natsu-anon/STOWAWAY/main/screenshots/bot2.PNG)
Once you login you or if you already are you should see something like this.

2. Click the 'New Application' button in the top right.
3. Enter a name for your new bot.  Don't worry--this won't be its username.  Next go ahead a click 'Create'.

![create application](https://media.githubusercontent.com/media/natsu-anon/STOWAWAY/main/screenshots/bot3.PNG)

4. Next, click on the 'Bot' button in the sidebar.  You should end up at a page that looks like the following image.

![bot sidebar](https://media.githubusercontent.com/media/natsu-anon/STOWAWAY/main/screenshots/bot4.PNG)

5. Click 'Add Bot'. When the warning says "this action is irrevocable!" it means that you can _never_ remove the bot from this app.  You can always delete this app which also deletes the bot.

![add a bot](https://media.githubusercontent.com/media/natsu-anon/STOWAWAY/main/screenshots/bot5.PNG)

6. _'Yes, do it!'_
7. Feel free to change your bot's username and icon.  You can always change both later.

![bot created](https://media.githubusercontent.com/media/natsu-anon/STOWAWAY/main/screenshots/bot6.PNG)

8. Disable 'PUBLIC BOT'
9. Enable 'PRESENCE INTENT', and 'SERVER MEMBERS INTENT'
![bot settings](https://media.githubusercontent.com/media/natsu-anon/STOWAWAY/main/screenshots/bot7.PNG)

10. Make sure you save your changes!

When you launch ＳＴＯＷＡＷＡＹ, you must provide your bot's token to use the application.  You can copy your bot's token from its page by pressing the 'Copy' button in the Token section.  Most terminal applications allow you to paste text with by right-clicking.

** NEVER SHARE YOUR BOT TOKEN WITH ANYONE **

![token copy](https://media.githubusercontent.com/media/natsu-anon/STOWAWAY/main/screenshots/bot8.PNG)
![token paste](https://media.githubusercontent.com/media/natsu-anon/STOWAWAY/main/screenshots/bot9.PNG)


[//]: # (TODO: write this up with screenshots)

### Add your bot to a server
1. Go to your application's "General Information" page
2. Copy your client id

![get client id](https://media.githubusercontent.com/media/natsu-anon/STOWAWAY/main/screenshots/server1.PNG)

3. Go to the following link, but replace `CLIENT_ID` with your client id
```
https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&permissions=117760&scope=bot
```

4. Add to the desired server.  Note that you need to have the *Manage Server* permission in whatever server you want to add your bot to.
![add to server](https://media.githubusercontent.com/media/natsu-anon/STOWAWAY/main/screenshots/server2.PNG)

## Usage
>When you say, "I have nothing to hide," you’re saying, "I don’t care about this right." You’re saying, "I don’t have this right, because I’ve got to the point where I have to justify it." **The way rights work is, the government has to justify its intrusion into your rights.**
>
> -Edward Snowden

### Launching executable
Just run it!

### Launching from command line
If you don't pass any optional flags ＳＴＯＷＡＷＡＹ will launch regularly.
However, you can also pass `-c` or `--channels` to print out all the channels available/inavailable to your bot with reasons why.

![add to server](https://media.githubusercontent.com/media/natsu-anon/STOWAWAY/single-channel/screenshots/permissions.PNG)

Additionally,  pass `-h` or `--help` for help.  Pass `-v` or `--version` for the version number.  Pass `-a` or `--about` for some basic information about ＳＴＯＷＡＷＡＹ.
And if you're running ＳＴＯＷＡＷＡＹ from source you can use `npm run start` to launch ＳＴＯＷＡＷＡＹ, and `npm run channels`, `npm run help`, `npm run version`, and `npm run about` for their respective flags.

## PGP Encryption
>There is no killer answer yet. Jacob Appelbaum (@ioerror) has a clever response, asking people who say this to then hand him their phone unlocked and pull down their pants. My version of that is to say, 'well, if you're so boring then we shouldn't be talking to you, and neither should anyone else', but philosophically, the real answer is this: [M]ass surveillance is a mass structural change. **When society goes bad, it's going to take you with it, even if you are the blandest person on earth.**
>
> -Julian Assange

[I suggest checking out the excellent comp.security.pgp general questions & introduction](http://www.pgp.net/pgpnet/pgp-faq/pgp-faq-general-questions.html).  For the specifics of how ＳＴＯＷＡＷＡＹ encrypts and decrypts messages Wikipedia's entries on [Pretty Good Privacy](https://en.wikipedia.org/wiki/Pretty_Good_Privacy) and [Public-key Cryptography](https://en.wikipedia.org/wiki/Public-key_cryptography) are solid launching off points.

## Future Development
>Not merely was my own mail opened, but the mail of all my relatives and friends — people residing in places as far apart as California and Florida. I recall the bland smile of a government official to whom I complained about this matter: **"If you have nothing to hide you have nothing to fear."** My answer was that a study of many labor cases had taught me the methods of the agent provocateur. **He is quite willing to take real evidence if he can find it; but if not, he has familiarized himself with the affairs of his victim, and can make evidence which will be convincing when exploited by the yellow press.**
>
> -Upton Sinclar in **The Profits of Religion**

1. Navigate through all servers & channels available to the bot
2. nicknames
3. **UPDATE REMINDERS**
4. WASM
5. option to display nickname associated w/ key
6. password encrypted private key?
7. Handshake protocol performed through DM's (can bots DM each other?)
8. More PGP features (key + message signing & key revoking)
9. See who's signed whose keys for a "web of trust".
10. Humans dm the bot `about` to find out more w/ link to repo

And in general I need to check out v8 options to see what'd I should bake into the executables

## Donations
ＳＴＯＷＡＷＡＹ is [FLOSS](https://www.gnu.org/philosophy/floss-and-foss.en.html) (Free/Libre, and Open Source Software) because I wouldn't trust any encryption service that requires payment and doesn't allow me to view the source code, so why would I make others? So, if you like what's going on here and have some money burning a hole in your pocket, here's how you can donate.
- BTC wallet: bc1q9c4cy76wpe84tcxftjw9k7wmshdndf32npkgg3
- ETH wallet: 0x6C5e469C3df5aB4A9c147E79c3a7a1356fa250A5
- DOGE wallet: DS87ZXf2vXoUQmy3Wr5nNNNSiSGM55uGJs

If you want to donate via PayPal, click the Sponsor button up top (yes, the [Ko-fi](https://ko-fi.com/natsusoft) button)!

## License
[Do What the Fuck You Want to Public License](http://www.wtfpl.net/)(version 2 or any later version).  Please take a look at the [LICENSE](LICENSE) file for more information.
