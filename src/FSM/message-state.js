const State = require('./state.js')

class MessageState extends State {
	constructor (id) {
		this._id = id;
	}

	enter () {
		this.emit('enter')
	}

	exit () {
		this.emit('exit')
	}
}

module.exports = MessageState;
