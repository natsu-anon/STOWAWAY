const State = require('./state.js');

class HelpState extends State {
	#enter;
	#exit;
	#prevState

	constructor (args) {
		super();
		this.#enter = args.enter;
		this.#exit = args.exit;
		this.backtick = () => { this.emit('to notification'); };
	}

	get helpText () {
		return this.state != null ? this.state.helpText : super.helpText;
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

	ctrlA () {
		if (this.#prevState != null) {
			this.emit('to about', this.#prevState);
		}
	}

	escape () {
		if (this.#prevState != null) {
			this.emit('to previous', this.#prevState);
		}
	}
}

module.exports = HelpState;
