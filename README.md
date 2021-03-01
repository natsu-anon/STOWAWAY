```
      _  __ __        __        __
 //  /_` / / / | | | /_/ | | | /_/ /_/  //
//  ._/ / /_/  |/|/ / /  |/|/ / /  /   //
This software is licensed under the WTFPL
```
An End-to-End PGP encryption layer for discord focused on ease-of-use via bots.
This means that the keys used to encrypt & decrypt messages are different--the keys to encrypt are *public*, the keys to decrypt are *private* and should __NEVER__ be shared.

SCREENSHOTS SOON :tm:

[//]: # (TODO: screenshots)

**Topics**
- [Setup](#setup)
- [Usage](#usage)
- [PGP Encryption](#pgp-encryption)
- [License](#license)


## Setup

### Installation
you can either run ＳＴＯＷＡＷＡＹ from source with [Node.js](https://nodejs.org/en/) or download a binary and run it that way.

#### Download a binary
Just [download the latest appropriate ＳＴＯＷＡＷＡＹ](https://github.com/natsu-anon/STOWAWAY/releases/tag/version-0.2.0) and extract the zip file. **NOTE** I've only tested the windows binary.


#### Running from source
you can run ＳＴＯＷＡＷＡＹ from source with [Node.js](https://nodejs.org/en/)(version 14.15.4) and the following packages:
- [OpenPGP.js](https://github.com/openpgpjs/openpgpjs) version 4.10.8
- [discord.js](https://github.com/discordjs/discord.js) version 12.5.1
- [blessed](https://github.com/chjj/blessed) version 0.1.81
- [NeDB](https://github.com/louischatriot/nedb/) version 1.8.0

[//]: # (TODO: include npm run start [channel_id])

### Creating a Bot
HOLUP

[//]: # (TODO: write this up with screenshots)

### Adding your bot to the server
1. Go to your application's "General Information" page
2. Copy your client id
3. go to the following link, but replace `CLIENT_ID` with your client id
```
https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&permissions=117824&scope=bot
```
4. add to the desired server (note: you need permission to add bots to servers)

## Usage
H O L U P
[//]: # (TODO: write this up with command line args/file explained)

## PGP Encryption
[I suggest checking out the excellent comp.security.pgp general questions & introduction](http://www.pgp.net/pgpnet/pgp-faq/pgp-faq-general-questions.html).  For the specifics of how ＳＴＯＷＡＷＡＹ encrypts and decrypts messages Wikipedia's entry on [Pretty Good Privacy](https://en.wikipedia.org/wiki/Pretty_Good_Privacy) and [Public-key Cryptography](https://en.wikipedia.org/wiki/Public-key_cryptography) are solid launching off points.


## License
[Do What the Fuck You Want to Public License](http://www.wtfpl.net/)(version 2 or any later version).  Please take a look at the [LICENSE](LICENSE) file for more information.
