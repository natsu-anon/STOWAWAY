const State = require('./state.js');
const KEYBINDS =
`[Enter] handshake selected channel (if permissions allow) & begin reading it
[Escape] return to previous state
[W/S] scroll to previous/next channel
[A/D] jump to first channel in previous/next server
[Tab] begin reading current channel displayed in messages box (if possible)
[M] view members of current channel displayed in messages box (if possible)`;

class HandshakeState extends State {

	constructor (args) {
		super();
		this._enter = args.enter;
		this._exit = args.exit;
		this.backtick = () => { this.emit('to notification'); };
		this.ctrlR = () => { this.emit('to revoke', this); };
		this.ctrlA = () => { this.emit('to about', this); };
		this.ctrlK = () => { this.emit('to keybinds', this); };
	}

	get keybinds () {
		return KEYBINDS;
	}

	Enter (state) {
		this._enter(state);
	}

	Exit () {
		this._exit();
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

	m () {
		this.emit('to member');
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
