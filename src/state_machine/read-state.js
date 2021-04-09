const State = require('./state.js');
const { ReadColor } = require('./state-colors.js');

class ReadState extends State {
	#enter;
	#exit;

	constructor (args) {
		super();
		this.#enter = args.enter;
		this.#exit = args.exit;
		this.ctrlR = () => { this.emit('to revoke', this); };
		this.ctrlA = () => { this.emit('to about', this); };
		this.ctrlK = () => { this.emit('to keybinds', this); };
		this.backtick = () => { this.emit('to notification'); };
		this.e = () => { this.emit('to handshake', this); };
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

	Enter (args) {
		this.#enter(args);
	}

	Exit () {
		this.#exit();
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

	h () {
		this.emit('handshake');
	}

	m () {
		this.emit('to member');
	}
}

module.exports = ReadState;
