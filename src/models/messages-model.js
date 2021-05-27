const Model = require('./model.js');

class ChannelMessage {
	constructor (publicFlag, date, member, verified, signed, plainText) {
		this.publicFlag = publicFlag;
		this.date = date;
		this.name = signed ? `{green-fg}${member.displayName}{/green-fg}` : member.displayName;
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
	constructor (date, member) {
		this.date = date;
		this.name = member.displayName;
		this.tag = member.user.tag;
	}

	get text () {
		return `{red-fg}[${this.date.toLocaleDateString()} ${this.date.toLocaleTimeString()}] <{underline}${this.name}{/underline}> Failed to decrypt message from {underline}${this.tag}{/}\n`;
	}
}

class Handshake {
	constructor (date, member, accepted) {
		this.date = date;
		this.name = member.displayName;
		this.tag = member.user.tag;
		this.accepted = accepted;
	}

	get text () {
		if (this.accepted) {
			return `\t{green-bg}{black-fg}${this.name} (${this.tag}) handshake at ${this.date.toLocaleDateString()} ${this.date.toLocaleTimeString()}{/}`;
		}
		else {
			return `\t{red-bg}{black-fg}${this.name} (${this.tag}) bad handshake at ${this.date.toLocaleDateString()} ${this.date.toLocaleTimeString()}{/}`;
		}
	}
}

class SignedKey {
	constructor (date, member) {
		this.date = date;
		this.name = member.displayName;
		this.tag = member.user.tag;
	}

	get text () {
		return `\t{cyan-bg}{black-fg}${this.name} (${this.tag}) signed your key at ${this.date.toLocaleDateString()} ${this.date.toLocaleTimeString()}{/}`;
	}
}

class KeyUpdate {
	constructor (date, member) {
		this.date = date;
		this.name = member.displayName;
		this.tag = member.user.tag;
	}

	get text () {
		return `\t{cyan-bg}{black-fg}${this.name} (${this.tag}) updated his key at ${this.date.toLocaleDateString()} ${this.date.toLocaleTimeString()}{/}`;
	}
}

class Revocation {
	constructor (date, member, blockReason) {
		this.date = date;
		this.name = member.displayName;
		this.tag = member.user.tag;
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


class MessagesModel extends Model {

	constructor (stowaway) {
		super();
		stowaway.on('channel message', (message, data, publicFlag) => { this._channelMessage(message, data, publicFlag); });
		stowaway.on('decryption failure', message => { this._decryptionFailure(message); });
		stowaway.on('handshake', (message, accepted) => { this._handshake(message, accepted); });
		stowaway.on('signed key', message => { this._signedKey(message); });
		stowaway.on('key update', message => { this._keyUpdate(message); });
		stowaway.on('revocation', (message, blockReason) => { this._revocation(message, blockReason); });
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
				content: new ChannelMessage(publicFlag, message.createdAt, message.member, data.verified, data.signed, data.plainText)
			});
			this._sortThenUpdate();
		}
	}

	_decryptionFailure (message) {
		if (message.channel.id === this.channelId) {
			this._messages.push({
				id: message.id,
				timestamp: message.createdTimestamp,
				content: new DecryptionFailure(message.createdAt, message.member)
			});
			this._sortThenUpdate();
		}
	}

	_handshake (message, accepted) {
		if (message.channel.id === this.channelId) {
			this._messages.push({
				id: message.id,
				timestamp: message.createdTimestamp,
				content: new Handshake(message.createdAt, message.member, accepted)
			});
			this._sortThenUpdate();
		}
	}

	_signedKey (message) {
		if (message.channel.id === this.channelId) {
			this._messages.push({
				id: message.id,
				timestamp: message.createdTimestamp,
				content: new SignedKey(message.createdAt, message.member)
			});
			this._sortThenUpdate();
		}
	}

	_keyUpdate (message) {
		if (message.channel.id === this.channelId) {
			this._messages.push({
				id: message.id,
				timestamp: message.createdTimestamp,
				content: new KeyUpdate(message.createdAt, message.member)
			});
			this._sortThenUpdate();
		}
	}

	_revocation (message, blockReason) {
		if (message.channel.id === this.channelId) {
			this._messages.push({
				id: message.id,
				timestamp: message.createdTimestamp,
				content: new Revocation(message.createdAt, message.member, blockReason)
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
