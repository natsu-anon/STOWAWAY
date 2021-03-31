const State = require('./state.js');

class HandshakeState extends State {
	#enter;
	#exit;
	#prevState;

	constructor (args) {
		super();
		this.#enter = args.enter;
		this.#exit = args.exit;
		this.backtick = () => { this.emit('to notification'); };
		this.ctrlR = () => { this.emit('to revoke', this); };
		this.ctrlA = () => { this.emit('to about', this); };
		this.ctrlH = () => { this.emit('to help', this); };
	}

	prevState (state) {
		this.#prevState = state;
		return this;
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

	enter () {
		this.emit('handshake');
	}

	w () {
		this.emit('channels', false);
	}

	s () {
		this.emit('channels', true);
	}

	a () {
		this.emit('servers', false);
	}

	d () {
		this.emit('servers', true);
	}
}

module.exports = HandshakeState;
