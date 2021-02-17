const State = require('./state.js')

class MessageState extends State {
	constructor () {
	}

	enter () {
		this.emit('enter')
	}

	exit () {
		this.emit('exit')
	}
}

module.exports = MessageState;
