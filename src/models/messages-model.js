const Model = require('./model.js');

class ChannelMessage {
	constructor (publicFlag, date, author, verified, signed, plainText) {
		this.publicFlag = publicFlag;
		this.date = date;
		this.name = signed ? `{green-fg}${author.username}{/green-fg}` : author.username;
		if (!verified) {
			this.name = `${this.name}{yellow-fg}(UNVERIFIED){/yellow-fg}`;
		}
		this.plainText = plainText;
	}

	get text () {
		if (this.publicFlag) {
			return `{blue-fg}[${this.date.toLocaleDateString()} ${this.date.toLocaleTimeString()}] <{/}${this.name}{blue-fg}>{/} ${this.plainText}{/}`;
		}
		else {
			return `{cyan-fg}[${this.date.toLocaleDateString()} ${this.date.toLocaleTimeString()}] <{/}${this.name}{cyan-fg}>{/} ${this.plainText}{/}`;
		}
	}
}

class DecryptionFailure {
	constructor (date, author) {
		this.date = date;
		this.name = author.username;
		this.tag = author.tag;
	}

	get text () {
		return `{yellow-fg}[${this.date.toLocaleDateString()} ${this.date.toLocaleTimeString()}] <{underline}${this.name}{/underline}> Failed to decrypt message from {underline}${this.tag}{/}`;
	}
}

class Handshake {
	constructor (date, author, accepted) {
		this.date = date;
		this.name = author.username;
		this.tag = author.tag;
		this.accepted = accepted;
	}

	get text () {
		if (this.accepted) {
			return `\t{green-bg}{black-fg}${this.name} (${this.tag}) handshake at ${this.date.toLocaleDateString()} ${this.date.toLocaleTimeString()}{/}`;
		}
		else {
			return `\t{yellow-bg}{black-fg}${this.name} (${this.tag}) bad handshake at ${this.date.toLocaleDateString()} ${this.date.toLocaleTimeString()}{/}`;
		}
	}
}

class SignedKey {
	constructor (date, author) {
		this.date = date;
		this.name = author.username;
		this.tag = author.tag;
	}

	get text () {
		return `\t{cyan-bg}{black-fg}${this.name} (${this.tag}) signed your key at ${this.date.toLocaleDateString()} ${this.date.toLocaleTimeString()}{/}`;
	}
}

class KeyUpdate {
	constructor (date, author) {
		this.date = date;
		this.name = author.username;
		this.tag = author.tag;
	}

	get text () {
		return `\t{cyan-bg}{black-fg}${this.name} (${this.tag}) updated his key at ${this.date.toLocaleDateString()} ${this.date.toLocaleTimeString()}{/}`;
	}
}

class Revocation {
	constructor (date, author, blockReason) {
		this.date = date;
		this.name = author.username;
		this.tag = author.tag;
		this.blockReason = blockReason;
	}

	get text () {
		if (this.blockReason != null) {
			let res = `\t{red-bg}{underline}BLOCKED {black-fg}$this.name ${this.tag} from revoking his key at ${this.date.toLocaleDateString()} ${this.date.toLocaleTimeString()}{/}\n`;
			res += `{red-fg}{underline}REASON{/underline}: ${this.blockReason}{/}`;
			return res;

		}
		else {
			return `\t{yellow-bg}{black-fg}${this.name} (${this.tag}) revoked his key at ${this.date.toLocaleDateString()} ${this.date.toLocaleTimeString()}, if you signed his old key consider signing his new one (if you trust this revocation){/}`;
		}
	}
}

class Compromised {
	constructor (date, message) {
		this.date = date;
		this.name = message.author.username;
		this.tag = message.author.tag;
		this.channelId = message.channel.id;
		this.messageId = message.id;
	}

	get text () {
		let res = `\t{red-bg}{black-fg}POSSIBLY COMPROMISED USER: ${this.name} (${this.tag}) at ${this.date.toLocaleDateString()} ${this.date.toLocaleTimeString()}{/}\n`;
		res += `\t{red-bg}{black-fg}IF YOU BELIEVE USER IS NOT COMPROMISED TO MANUALLY UPDATE LOCAL DATA FOR ${this.tag} RUN:{/}\n`;
		res += `\t{red-bg}{black-fg}\tstowaway --overwrite ${this.channelId} ${this.messageId}{/}`;
		return res;
	}
}


class MessagesModel extends Model {

	constructor (stowaway) {
		super();
		stowaway.on('channel message', (message, data, publicFlag) => { this._channelMessage(message, data, publicFlag); });
		stowaway.on('decryption failure', message => { this._decryptionFailure(message); });
		stowaway.on('handshake', (message, accepted) => { this._handshake(message, accepted); });
		stowaway.on('signed key', message => { this._signedKey(message); });
		stowaway.on('key update', message => { this._keyUpdate(message); });
		stowaway.on('revocation', (message, blockReason) => { this._revocation(message, blockReason); });
		stowaway.on('compromised', message => { this._compromised(message); });
	}

	listen (channelId) {
		this._messages = [];
		this.channelId = channelId;
		this.emit('update', '');
	}

	get oldestId () {
		return this._messages.length > 0 ? this._messages[0].id : null;
	}

	get newestId () {
		return this._messages.length > 0 ? this._messages[this._messages.length - 1].id : null;
	}

	get text () {
		return this._messages.map(message => message.content.text).join('\n');
	}

	_channelMessage (message, data, publicFlag) {
		if (message.channel.id === this.channelId) {
			this._messages.push({
				id: message.id,
				timestamp: message.createdTimestamp,
				content: new ChannelMessage(publicFlag, message.createdAt, message.author, data.verified, data.signed, data.plainText)
			});
			this._sortThenUpdate();
		}
	}

	_decryptionFailure (message) {
		if (message.channel.id === this.channelId) {
			this._messages.push({
				id: message.id,
				timestamp: message.createdTimestamp,
				content: new DecryptionFailure(message.createdAt, message.author)
			});
			this._sortThenUpdate();
		}
	}

	_handshake (message, accepted) {
		if (message.channel.id === this.channelId) {
			this._messages.push({
				id: message.id,
				timestamp: message.createdTimestamp,
				content: new Handshake(message.createdAt, message.author, accepted)
			});
			this._sortThenUpdate();
		}
	}

	_signedKey (message) {
		if (message.channel.id === this.channelId) {
			this._messages.push({
				id: message.id,
				timestamp: message.createdTimestamp,
				content: new SignedKey(message.createdAt, message.author)
			});
			this._sortThenUpdate();
		}
	}

	_keyUpdate (message) {
		if (message.channel.id === this.channelId) {
			this._messages.push({
				id: message.id,
				timestamp: message.createdTimestamp,
				content: new KeyUpdate(message.createdAt, message.author)
			});
			this._sortThenUpdate();
		}
	}

	_revocation (message, blockReason) {
		if (message.channel.id === this.channelId) {
			this._messages.push({
				id: message.id,
				timestamp: message.createdTimestamp,
				content: new Revocation(message.createdAt, message.author, blockReason)
			});
			this._sortThenUpdate();
		}
	}

	_compromised (message) {
		if (message.channel.id === this.channelId) {
			this._messages.push({
				id: message.id,
				timestamp: message.createdTimestamp,
				content: new Compromised(message.createdAt, message)
			});
			this._sortThenUpdate();
		}
	}

	_sortThenUpdate() {
		this._messages.sort((a, b) => { return a.timestamp - b.timestamp; });
		this.emit('update', this.text);
	}
}

module.exports = MessagesModel;
