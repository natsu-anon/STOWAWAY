const State = require('./state.js');
const { NavigateColor } = require('./state-colors.js');

class NavigateState extends State {
	#enter;
	#exit;

	constructor (args) {
		super();
		this.#enter = args.enter;
		this.#exit = args.exit;
		this.backtick = () => { this.emit('to notification'); };
		this.e = () => { this.emit('to handshake', this); };
		this.ctrlR = () => { this.emit('to revoke', this); };
		this.ctrlA = () => { this.emit('to about', this); };
		this.ctrlQ = () => { this.emit('to help', this); };
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
		return 'NAVIGATE';
	}

	get color () {
		return NavigateColor;
	}

	Enter () {
		this.#enter();
	}

	Exit () {
		this.#exit();
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
