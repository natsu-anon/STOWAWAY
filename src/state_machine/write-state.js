const State = require('./state.js');

class WriteState extends State {
	#enter;
	#exit;

	constructor (args) {
		super();
		this.#enter = args.enter;
		this.#exit = args.exit;
	}

	Enter (publicFlag) {
		this.#enter(publicFlag);
	}

	Exit () {
		this.#exit();
	}

	escape () {
		this.emit('clear');
	}

	enter () {
		this.emit('send');
	}

}

module.exports = WriteState;
