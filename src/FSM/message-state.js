const State = require('./state.js')

class MessageState extends State {
	constructor (prevState) {
		this.prevState = prevState;
	}

	set previous (state) {
		this.prevState = state;
	}

	enter () {
		this.emit('enter')
	}

	exit () {
		this.emit('exit')
	}
}

module.exports = MessageState;
