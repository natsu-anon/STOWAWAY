const State = require('./state.js')

class NavigateState extends State{
	constructor () {
		if (new.target === State) {
			throw new TypeError('Abstract class "NavigateState" cannot be instantiated directly');
		}
		// TODO methods to require implementing
	}
}

module.exports = NavigateState;
