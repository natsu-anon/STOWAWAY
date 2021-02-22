const State = require('./state.js')

class InputState extends State {
	constructor (prevState) {
		this.prevState = prevState;
	}

	enter () {
		this.emit('enter')
	}

	exit () {
		this.emit('exit')
	}
}

module.exports = InputState;
