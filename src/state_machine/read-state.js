const State = require('./state.js');

class ReadState extends State {
	constructor (enter, exit) {
		super();
		this._enter = enter;
		this._exit = exit;
	}

	enter () {
		this._enter();
	}

	exit () {
		this._exit();
	}

	onCtrlC () {
		this.emit('quit');
	}

	onSpace () {
		this.emit('to write');
	}

	onW () {
		this.emit('scroll', -1);
	}

	onS () {
		this.emit('scroll', 1);
	}
}

module.exports = ReadState;
