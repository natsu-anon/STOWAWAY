const State = require('./state.js');
const { ReadColor } = require('./state-colors.js');

const KEYBINDS = 
`[Enter] begin writing a public message to the current channel
[Ctrl-Enter] begin writing a signed-keys-only message to the current channel
[W] scroll up & load more messages if at the top
[S] scroll down & load more messages if at the bottom
[A] jump to the top of the messages
[D] jump to the bottom of the messages
[H] bring up handhshake channel selector
[M] view the members for the current channel
[Number] jump to associated favorite channel (if any)
[Shift-Number] assign favorite number to current channel
[Backspace/Delete] remove favorite number from current channel (if any)
[Tab] return to handshaked navigator`;

class ReadState extends State {

	constructor (args) {
		super();
		this._enter = args.enter;
		this._exit = args.exit;
		this.ctrlR = () => { this.emit('to revoke', this); };
		this.ctrlA = () => { this.emit('to about', this); };
		this.ctrlK = () => { this.emit('to keybinds', this); };
		this.backtick = () => { this.emit('to notification'); };
		this.backspace = () => { this.emit('clear favorite'); };
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
	}

	get name () {
		return 'Read';
	}

	get color () {
		return ReadColor;
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
		this.emit('to write', true);
	}

	ctrlEnter () {
		this.emit('to write', false);
	}

	backspace () {
		this.emit('clear favorite');
	}

	tab () {
		this.emit('to navigate');
	}

	h () {
		this.emit('to handshake', this);
	}

	m () {
		this.emit('to member');
	}

	w () {
		this.emit('scroll', -1);
	}

	s () {
		this.emit('scroll', 1);
	}

	a () {
		this.emit('scroll top');
	}

	d () {
		this.emit('scroll bottom');
	}
}

module.exports = ReadState;
