const State = require('./state.js');

class RevokeState extends State {
	#enter;
	#exit;

	constructor (args) {
		super();
		this.#enter = args.enter;
		this.#exit = args.exit;
		this.backtick = () => { this.emit('to notification'); };
	}

	Enter (state) {
		this.#enter(state);
	}

	Exit () {
		this.#exit();
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
