const EventEmitter = require('events')

class State extends EventEmitter {
	constructor () {
		super();
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

	onCtrlC () {
		// QUIT
	}

	onBacktick () {
		// jump to news item
	}

	onSpace () {}

	onEnter () {}

	onEsc () {}

	onTab () {}

	onW () {}

	onA () {}

	onS () {}

	onD () {}
}

module.exports = State;
