const State = require('./state.js')

class DMState extends NavigateState {
	enter () {
		this.emit('enter')
	}

	exit () {
		this.emit('exit')
	}
}

module.exports = DMState;
