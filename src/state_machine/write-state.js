const State = require('./state.js');
const { WriteColor } = require('./state-colors.js');

const KEYBINDS =
`[Enter] Send what is written to current channel
[Escape] Stop writing & clear what is written`;

class WriteState extends State {

	constructor (args) {
		super();
		this._enter = args.enter;
		this._exit = args.exit;
		this.ctrlR = () => { this.emit('to revoke', this); };
		this.ctrlA = () => { this.emit('to about', this); };
		this.ctrlK = () => { this.emit('to keybinds', this); };
	}

	get name () {
		return 'Write';
	}

	get color () {
		return WriteColor;
	}

	get keybinds () {
		return KEYBINDS;
	}

	Enter (publicFlag) {
		this._enter(publicFlag);
	}

	Exit () {
		this._exit();
	}

	escape () {
		this.emit('clear');
	}

	enter () {
		this.emit('send');
	}

}

module.exports = WriteState;
