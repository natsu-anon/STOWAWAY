const State = require('./state.js');

class AboutState extends State {
	#enter;
	#exit;

	constructor (args) {
		super();
		this.#enter = args.enter;
		this.#exit = args.exit;
		this.backtick = () => { this.emit('to notification'); };
		this.e = () => { this.emit('to handshake', this); };
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

module.exports = AboutState;
