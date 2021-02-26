const State = require('./state.js');

class WriteState extends State {
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

	onEsc () {
		this.emit('clear');
	}

	onTab () {
		this.emit('pause');
	}

	onEnter () {
		this.emit('send');
	}

}

module.exports = WriteState;
