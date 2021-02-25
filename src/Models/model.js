const EventEmitter = require('events')

class Model extends EventEmitter {
	constructor () {
		super();
		if (new.target === Model) {
			throw new TypeError('Abstract class "Model" cannot be instantiated directly');
		}
	}
}

module.exports = Model;
