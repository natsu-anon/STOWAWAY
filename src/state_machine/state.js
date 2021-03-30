const EventEmitter = require('events');

class State extends EventEmitter {
	constructor () {
		super();
		if (new.target === State) {
			throw new TypeError('Abstract class "State" cannot be instantiated directly');
		}
		if (this.enter === undefined) {
			throw new TypeError('Subclasses of "State" must implement this.enter');
		}
		if (this.exit === undefined) {
			throw new TypeError('Subclasses of "State" must implement this.exit');
		}
	}

	get helpText () {
		return 'FUG :DDDDDDDD';
	}

	ctrlC () {
		// QUIT
	}

	ctrlH () {
		// help
	}

	ctrlA () {
		// about
	}

	ctrlR () {
		// revoke
	}

	backtick () {
		// jump to latest notification item (if not writing)
	}

	ctrlEnter () {}

	enter () {}

	space () {}

	esc () {}

	tab () {}

	ctrlW () {}

	ctrlS () {}

	w () {}

	s () {}

	a () {}

	d () {}

	ctrl1 () {}

	ctrl2 () {}

	ctrl3 () {}

	ctrl4 () {}

	ctrl5 () {}

	ctrl6 () {}

	ctrl7 () {}

	ctrl8 () {}

	ctrl9 () {}

	ctrl0 () {}

	// jump to previously favorited channel (if not writing)
	num1 () {}

	num2 () {}

	num3 () {}

	num4 () {}

	num5 () {}

	num6 () {}

	num7 () {}

	num8 () {}

	num9 () {}

	num0 () {}
}

module.exports = State;
