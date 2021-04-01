const State = require('./state.js');

class AboutState extends State {
	#enter;
	#exit;
	#prevState;

	constructor (args) {
		super();
		this.#enter = args.enter;
		this.#exit = args.exit;
		this.backtick = () => { this.emit('to notification'); };
		this.e = () => { this.emit('to handshake', this); };
	}

	prevState (state) {
		this.#prevState = state;
		return this;
	}

	Enter () {
		this.#enter();
	}

	Exit () {
		this.#exit();
	}

	ctrlR () {
		if (this.#prevState != null) {
			this.emit('to revoke', this.#prevState);
		}
	}

	ctrlQ () {
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

module.exports = AboutState;
