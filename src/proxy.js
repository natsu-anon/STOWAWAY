const EventEmitter = require('events');

class Proxy : extends EventEmitter {
	constructor () {
	}
}

class ProxyBuilder {

	setSendEncrypted (sendEncrypted) {
		this.sendEncrypted = sendEncrypted;
		return this;
	}

	setSendPlaintext (sendPlaintext) {
		this.SendPlaintext = sendPlaintext;
		return this;
	}

	setOnMessage (onMessage) {
		this.onMessage = onMessage;
		return this;
	}

	setFetchMessages (fetchMessages) {
		this.fetchMessages = fetchMessages;
		return this;
	}

	build (client) {
		return 0;
		// return new Proxy();
	}
}

module.exports = {
	Builder : ProxyBuilder,
}
