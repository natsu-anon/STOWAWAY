const State = require('./state.js');

class WriteState extends State {
	constructor (fsm) {
		super();
		this.fsm = fsm;
	}

	onEscape () {
		this.emit('clear');
		this.fsm._read();
	}

	onTab () {
		this.emit('pause');
		this.fsm._read();
	}

	onEnter () {
		this.emit('send');
		this.fsm._read();
	}

}

module.exports = WriteState;
