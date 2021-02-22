const State = require('./state.js')

class ServersState extends NavigateState {
	constructor (model, updateFunc) {
		this.model = model;
		this.updateFunc = updateFunc;
	}

	jumpUp () {
		this.updateFunc(this.model.prevSkip())
	}

	jumpDown () {
		this.updateFunc(this.model.nextSkip());
	}

	scrollUp () {
		this.updateFunc(this.model.prevChannel());
	}

	scrollDown () {
		this.updateFunc(this.model.nextChannel());
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
		jumpUp();
	}

	onS () {
		scrollDown();
	}
	
	onD () {
		jumpDown();
	}
}

module.exports = ServersState;
