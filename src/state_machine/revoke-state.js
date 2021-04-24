const State = require('./state.js');

class RevokeState extends State {

	constructor (args) {
		super();
		this._enter = args.enter;
		this._exit = args.exit;
		this.backtick = () => { this.emit('to notification'); };
	}

	Enter (state) {
		this._enter(state);
	}

	Exit () {
		this._exit();
	}

	ctrlA () {
		if (this.previousState != null) {
			this.emit('to about', this.previousState);
		}
	}

	ctrlK () {
		if (this.previousState != null) {
			this.emit('to keybinds', this.previousState);
		}
	}

	escape () {
		if (this.previousState != null) {
			this.emit('to previous', this.previousState);
		}
	}
}

module.exports = RevokeState;
