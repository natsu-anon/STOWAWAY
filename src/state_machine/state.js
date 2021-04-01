const EventEmitter = require('events');

class State extends EventEmitter {
	constructor () {
		super();
		if (new.target === State) {
			throw new TypeError('Abstract class "State" cannot be instantiated directly');
		}
		if (this.Enter === undefined) {
			throw new TypeError('Subclasses of "State" must implement this.enter');
		}
		if (this.Exit === undefined) {
			throw new TypeError('Subclasses of "State" must implement this.exit');
		}
	}

	get name () {
		return 'BENIS';
	}

	get color () {
		return 'green';
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

	escape () {}

	tab () {}

	ctrlW () {}

	ctrlS () {}

	w () {}

	s () {}

	a () {}

	d () {}

	e () {}

	h () {}

	m () {}

	ctrl0 () {}

	ctrl1 () {}

	ctrl2 () {}

	ctrl3 () {}

	ctrl4 () {}

	ctrl5 () {}

	ctrl6 () {}

	ctrl7 () {}

	ctrl8 () {}

	ctrl9 () {}

	// jump to previously favorited channel (if not writing)
	num0 () {}

	num1 () {}

	num2 () {}

	num3 () {}

	num4 () {}

	num5 () {}

	num6 () {}

	num7 () {}

	num8 () {}

	num9 () {}
}

module.exports = State;
