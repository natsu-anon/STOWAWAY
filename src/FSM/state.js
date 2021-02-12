const EventEmitter = require('events')

class State extends EventEmitter {
	constructor () {
		if (new.target === State) {
			throw new TypeError('Abstract class "State" cannot be instantiated directly');
		}
		if (this.enter === undefined) {
			throw new TypeError('Subclasses of "State" must implement this.enter')
		}
		if (this.exit === undefined) {
			throw new TypeError('Subclasses of "State" must implement this.exit')
		}
	}
}

module.exports = State;
