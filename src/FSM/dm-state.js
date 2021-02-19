const State = require('./state.js')

class DMState extends NavigateState {
	constructor (model, updateFunc) {
		this.model = model;
		this.updateFunc = updateFunc;
	}
	// needs some shit
	scrollUp () {
		this.updateFunc(this.model.prevDM());
	}

	scrollDown () {
		this.updateFunc(this.model.nextDM());
	}

	enter () {
		this.emit('enter')
	}

	exit () {
		this.emit('exit')
	}

	onW () {
		scrollUp();
	}

	onA () {
		scrollUp();
	}

	onS () {
		scrollDown();
	}

	onD () {
		scrollDown();
	}
}

module.exports = DMState;
