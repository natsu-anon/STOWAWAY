const Model = require('./model.js');

class ChannelMessage {
	constructor (date, member, verified, signed, plainText) {
		this.date = date;
		this.name = signed ? member.displayName : `{green-fg}${member.displayName}{/green-fg}`;
		this.verified = verified;
		this.plainText = plainText;
	}

	get text () {
		if (this.verified) {
			return `{blue-fg}[${this.date.toLocaleDateString()} ${this.date.toLocaleTimeString()}] <{/}${this.name}{blue-fg}>{/} ${this.plainText}{/}`;
		}
		else {
			return `{yellow-fg}[${this.date.toLocaleDateString()} ${this.date.toLocaleTimeString()}] <{/}${this.name}{yellow-fg}>{/} ${this.plainText}{/}`;
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
		return `\t{cyan-bg}{black-fg}${this.name} (${this.author.tag}) signed your key at ${this.date.toLocaleDateString()} ${this.date.toLocaleTimesString()}{/}`;
	}
}

class KeyUpdate {
	constructor (date, member) {
		this.date = date;
		this.name = member.displayName;
		this.tag = member.user.tag;
	}

	get text () {
		return `\t{cyan-bg}{black-fg}${this.name} (${this.author.tag}) updated his key at ${this.date.toLocaleDateString()} ${this.date.toLocaleTimesString()}{/}`;
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
			let res = `\t{red-bg}{underline}BLOCKED {black-fg}$this.name ${this.author.tag} from revoking his key at ${this.date.toLocaleDateString()} ${this.date.toLocaleTimeString()}{/}\n`;
			res += `{red-fg}{underline}REASON{/underline}: ${this.blockReason}{/}`;
			return res;

		}
		else {
			return `\t{green-bg}{black-fg}${this.name} (${this.author.tag}) revoked his key at ${this.date.toLocaleDateString()} ${this.date.toLocaleTimesString()}{/}`;
		}
	}
}


class MessagesModel extends Model {
	#messages;

	constructor (stowaway) {
		super();
		stowaway.on('channel message', (message, data) => { this.#channelMessage(message, data); });
		stowaway.on('decryption failure', this.#decryptionFailure);
		stowaway.on('handshake', (accepted, message) => { this.#handshake(message, accepted); });
		stowaway.on('signed key', this.#signedKey);
		stowaway.on('key update', this.#keyUpdate);
		stowaway.on('revocation', this.#keyUpdate);
	}

	listen (channelId) {
		this.#messages = [];
		this.channelId = channelId;
		this.emit('update', '');
	}

	get oldestTs () {
		return this.#messages[0].timestamp;
	}

	get newestTs () {
		return this.#messages[this.#messages.length - 1].timestamp;
	}

	get text () {
		return this.#messages.map(message => message.content.text).join('\n');
	}

	#channelMessage (message, data) {
		if (message.channel.id === this.channelId) {
			this.#messages.push({
				timestamp: message.createdTimestamp,
				content: new ChannelMessage(message.createdAt, message.member, data.verified, data.signed, data.plainText)
			});
			this.#sortThenUpdate();
		}
	}

	#decryptionFailure (message) {
		if (message.channel.id === this.channelId) {
			this.#messages.push({
				timestamp: message.createdTimestamp,
				content: new DecryptionFailure(message.createdAt, message.member)
			});
			this.#sortThenUpdate();
		}
	}

	#handshake (message, accepted) {
		if (message.channel.id === this.channelId) {
			this.#messages.push({
				timestamp: message.createdTimestamp,
				content: new Handshake(message.createdAt, message.member, accepted)
			});
			this.#sortThenUpdate();
		}
	}

	#signedKey (message) {
		if (message.channel.id === this.channelId) {
			this.#messages.push({
				timestamp: message.createdTimestamp,
				content: new SignedKey(message.createdAt, message.member)
			});
			this.#sortThenUpdate();
		}
	}

	#keyUpdate (message) {
		if (message.channel.id === this.channelId) {
			this.#messages.push({
				timestamp: message.createdTimestamp,
				content: new KeyUpdate(message.createdAt, message.member)
			});
			this.#sortThenUpdate();
		}
	}

	#revocation (message, blockReason) {
		if (message.channel.id === this.channelId) {
			this.#messages.push({
				timestamp: message.createdTimestamp,
				content: new Revocation(message.createdAt, message.member, blockReason)
			});
			this.#sortThenUpdate();
		}
	}

	#sortThenUpdate() {
		this.#messages.sort((a, b) => { return a.timestamp - b.timestamp; });
		this.emit('update', this.text);
	}
}

module.exports = MessagesModel;
