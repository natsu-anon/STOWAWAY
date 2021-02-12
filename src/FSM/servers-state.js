const State = require('./state.js')

class ServersState extends NavigateState {
	enter () {
		this.emit('enter')
	}

	exit () {
		this.emit('exit')
	}
}

module.exports = ServersState;
