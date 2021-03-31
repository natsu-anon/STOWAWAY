const State = require('./state.js');

class NavigateState extends State {
	#enter;
	#exit;

	constructor (args) {
		super();
		this.#enter = args.enter;
		this.#exit = args.exit;
		this.backtick = () => { this.emit('to notification'); };
		this.ctrlR = () => { this.emit('to revoke', this); };
		this.ctrlA = () => { this.emit('to about', this); };
		this.ctrlH = () => { this.emit('to help', this); };
		this.ctrl0 = () => { this.emit('set favorite', 0); };
		this.ctrl1 = () => { this.emit('set favorite', 1); };
		this.ctrl2 = () => { this.emit('set favorite', 2); };
		this.ctrl3 = () => { this.emit('set favorite', 3); };
		this.ctrl4 = () => { this.emit('set favorite', 4); };
		this.ctrl5 = () => { this.emit('set favorite', 5); };
		this.ctrl6 = () => { this.emit('set favorite', 6); };
		this.ctrl7 = () => { this.emit('set favorite', 7); };
		this.ctrl8 = () => { this.emit('set favorite', 8); };
		this.ctrl9 = () => { this.emit('set favorite', 9); };
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

	Enter () {
		this.#enter();
	}

	Exit () {
		this.#exit();
	}

	enter () {
		this.emit('to read', true);
	}

	tab () {
		this.emit('to read', false);
	}

	ctrlW () {
		this.emit('handshaked', -1);
	}

	ctrlS () {
		this.emit('handshaked', 1);
	}

	w () {
		this.emit('scroll', -1);
	}

	s () {
		this.emit('scroll', 1);
	}

	a () {
		this.emit('server', -1);
	}

	d () {
		this.emit('server', 1);
	}

	m () {
		this.emit('to member');
	}
}

module.exports = NavigateState;
