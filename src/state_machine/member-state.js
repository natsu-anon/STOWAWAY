const State = require('./state.js');

class MemberState extends State {
	#enter;
	#exit;

	constructor (args) {
		super();
		this.#enter = args.enter;
		this.#exit = args.exit;
	}

	Enter () {
		this.#enter();
	}

	Exit () {
		this.#exit();
	}

	enter () {
		this.emit('sign member');
	}

	escape () {
		this.emit('to read');
	}

	w () {
		this.emit('scroll', -1);
	}

 	a () {
		this.emit('scroll', 1);
	}
}

module.exports = MemberState;
