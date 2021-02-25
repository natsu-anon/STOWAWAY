const State = require('./state.js');

class ReadState extends State {
	constructor (fsm) {
		super();
		this.fsm = fsm;
	}

	onCtrlC () {
		this.emit('quit');
	}

	onSpace () {
		this.fsm._write();
	}

	onW () {
		this.emit('scroll up');
	}

	onD () {
		this.emit('scroll up');
	}
}

module.exports = ReadState;
