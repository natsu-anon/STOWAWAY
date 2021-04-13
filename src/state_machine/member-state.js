const State = require('./state.js');
const { MemberColor } = require('./state-colors.js');

class MemberState extends State {
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
	}

	get name () {
		return 'Members';
	}

	get color () {
		return MemberColor;
	}

	Enter () {
		this.#enter();
	}

	Exit () {
		this.#exit();
	}

	enter () {
		this.emit('sign member');
	}

	escape () {
		this.emit('to read');
	}

	w () {
		this.emit('scroll', -1);
	}

 	a () {
		this.emit('scroll', 1);
	}
}

module.exports = MemberState;
