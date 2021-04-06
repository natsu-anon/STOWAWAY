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

	get help () {
		return 'FUG :DDDDDDDD';
	}

	ctrlC () {}

	ctrlR () {}

	ctrlA () {}

	ctrlK () {}

	escape () {}

	backtick () {}

	ctrlEnter () {} // this is the 'linefeed' sequence

	enter () {}

	backspace () {}

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

	shift0 () {}

	shift1 () {}

	shift2 () {}

	shift3 () {}

	shift4 () {}

	shift5 () {}

	shift6 () {}

	shift7 () {}

	shift8 () {}

	shift9 () {}

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
