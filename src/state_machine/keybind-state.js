const State = require('./state.js');

class KeybindState extends State {
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

	ctrlR () {
		if (this.previousState != null) {
			this.emit('to revoke', this.previousState);
		}
	}

	ctrlA () {
		if (this.previousState != null) {
			this.emit('to about', this.previousState);
		}
	}

	escape () {
		if (this.previousState != null) {
			this.emit('to previous', this.previousState);
		}
	}
}

module.exports = KeybindState;
