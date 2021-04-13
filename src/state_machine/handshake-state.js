const State = require('./state.js');

class HandshakeState extends State {
	#enter;
	#exit;

	constructor (args) {
		super();
		this.#enter = args.enter;
		this.#exit = args.exit;
		this.backtick = () => { this.emit('to notification'); };
		this.ctrlR = () => { this.emit('to revoke', this); };
		this.ctrlA = () => { this.emit('to about', this); };
		this.ctrlH = () => { this.emit('to keybinds', this); };
	}

	Enter (state) {
		this.#enter(state);
	}

	Exit () {
		this.#exit();
	}

	ctrlR () {
		if (this.previousState != null) {
			this.emit('to revoke', this.prevState);
		}
	}

	ctrlA () {
		if (this.previousState != null) {
			this.emit('to about', this.prevState);
		}
	}

	ctrlQ () {
		if (this.previousState != null) {
			this.emit('to keybinds', this.prevState);
		}
	}

	escape () {
		if (this.previousState != null) {
			this.emit('to previous', this.previousState);
		}
	}

	enter () {
		this.emit('handshake');
	}

	tab () {
		this.emit('to read', false);
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
