const State = require('./state.js');
const { NavigateColor } = require('./state-colors.js');

const KEYBINDS =
`[Enter] begin reading selected channel
[W/S] navigate to prev/next channel
[A/D] navigate to first channel of prev/next server
[H] bring up handhshake channel selector
[M] view the members for the current channel (if possible)
[Number] jump to associated favorite channel (if any)
[Shift-Number] assign favorite number to current channel
[Backspace/Delete] remove favorite number from current channel (if any)
[Tab] begin reading previously selected channel (if possible)`;

class NavigateState extends State {

	constructor (args) {
		super();
		this._enter = args.enter;
		this._exit = args.exit;
		this.backtick = () => { this.emit('to notification'); };
		this.ctrlR = () => { this.emit('to revoke', this); };
		this.ctrlA = () => { this.emit('to about', this); };
		this.ctrlK = () => { this.emit('to keybinds', this); };
		this.backspace = () => { this.emit('clear favorite'); };
		this.shift0 = () => { this.emit('set favorite', 0); };
		this.shift1 = () => { this.emit('set favorite', 1); };
		this.shift2 = () => { this.emit('set favorite', 2); };
		this.shift3 = () => { this.emit('set favorite', 3); };
		this.shift4 = () => { this.emit('set favorite', 4); };
		this.shift5 = () => { this.emit('set favorite', 5); };
		this.shift6 = () => { this.emit('set favorite', 6); };
		this.shift7 = () => { this.emit('set favorite', 7); };
		this.shift8 = () => { this.emit('set favorite', 8); };
		this.shift9 = () => { this.emit('set favorite', 9); };
		this.num0 = () => { this.emit('to favorite', 0); };
		this.num1 = () => { this.emit('to favorite', 1); };
		this.num2 = () => { this.emit('to favorite', 2); };
		this.num3 = () => { this.emit('to favorite', 3); };
		this.num4 = () => { this.emit('to favorite', 4); };
		this.num5 = () => { this.emit('to favorite', 5); };
		this.num6 = () => { this.emit('to favorite', 6); };
		this.num7 = () => { this.emit('to favorite', 7); };
		this.num8 = () => { this.emit('to favorite', 8); };
		this.num9 = () => { this.emit('to favorite', 9); };
	}

	get name () {
		return 'Navigate';
	}

	get color () {
		return NavigateColor;
	}

	get keybinds () {
		return KEYBINDS;
	}

	Enter () {
		this._enter();
	}

	Exit () {
		this._exit();
	}

	enter () {
		this.emit('to read', true);
	}

	backspace () {
		this.emit('clear favorite');
	}

	tab () {
		this.emit('to read', false);
	}

	h () {
		this.emit('to handshake', this);
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

module.exports = NavigateState;
