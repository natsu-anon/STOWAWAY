const EventEmitter = require('events');

class Mediator extends EventEmitter {
	constructor () {
		super();
		if (new.target === Mediator) {
			throw new TypeError('Abstract class "Mediator" cannot be instantiated directly');
		}
	}
}

module.exports = Mediator;
