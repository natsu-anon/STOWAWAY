const State = require('./state.js');
// const { HandshakeColor } = require('./state-colors.js');
const { HandshakeColor } = require('./state-colors.js');

const KEYBINDS =
`[Enter] handshake selected channel (if permissions allow) & begin reading it
[Escape] return to previous state
[W/S] scroll to previous/next channel
[A/D] jump to first channel in previous/next server
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

	get name () {
		return 'Handshake';
	}

	get color () {
		return HandshakeColor;
	}

	Enter (state) {
		if (state != null) {
			this.previousState = state;
			this._enter(state);
		}
		else if (this.previousState != null) {
			this._enter(this.previousState);
		}
		else {
			throw Error('Unable to complete state transition in HandshakeState.Enter()');
		}
	}

	Exit () {
		this._exit();
	}

	escape () {
		if (this.previousState != null) {
			this.emit('to previous', this.previousState);
		}
	}

	enter () {
		this.emit('handshake');
	}

	m () {
		this.emit('to member', this.previousState);
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
