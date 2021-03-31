const State = require('./state.js');

class RevokeState extends State {
	#enter;
	#exit;
	#prevState

	constructor (args) {
		super();
		this.#enter = args.enter;
		this.#exit = args.exit;
		this.backtick = () => { this.emit('to notification'); };
		this.e = () => { this.emit('to handshake', this); };
	}

	Enter () {
		this.#enter();
	}

	Exit () {
		this.#exit();
	}

	prevState (state) {
		this.#prevState = state;
		return this;
	}

	ctrlA () {
		if (this.#prevState != null) {
			this.emit('to about', this.#prevState);
		}
	}

	ctrlH () {
		if (this.#prevState != null) {
			this.emit('to help', this.#prevState);
		}
	}

	escape () {
		if (this.#prevState != null) {
			this.emit('to previous', this.#prevState);
		}
	}
}

module.exports = RevokeState;
