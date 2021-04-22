const State = require('./state.js');
const { MemberColor } = require('./state-colors.js');

const KEYBINDS =
`[Enter] sign currently selected (unless already signed)
[Escape] read currently selected channel
[W/S] scroll up/down members
[H] bring up handshake channel selector
[Tab] return to channel navigator`;

class MemberState extends State {

	constructor (args) {
		super();
		this._enter = args.enter;
		this._exit = args.exit;
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

	get keybinds () {
		return KEYBINDS;
	}

	Enter (args) {
		this._enter(args);
	}

	Exit () {
		this._exit();
	}

	enter () {
		this.emit('sign member');
	}

	escape () {
		this.emit('to read');
	}

	tab () {
		this.emit('to navigate');
	}

	w () {
		this.emit('scroll', -1);
	}

 	a () {
		this.emit('scroll', 1);
	}


	h () {
		this.emit('to handshake', this);
	}
}

module.exports = MemberState;
