const State = require('./state.js');
const { WriteColor } = require('./state-colors.js');

class WriteState extends State {
	#enter;
	#exit;

	constructor (args) {
		super();
		this.#enter = args.enter;
		this.#exit = args.exit;
		this.ctrlR = () => { this.emit('to revoke', this); };
		this.ctrlA = () => { this.emit('to about', this); };
		this.ctrlH = () => { this.emit('to help', this); };
	}

	get name () {
		return 'WRITE';
	}

	get color () {
		return WriteColor;
	}

	Enter () {
		this.#enter();
	}

	Exit () {
		this.#exit();
	}

	escape () {
		this.emit('clear');
	}

	enter () {
		this.emit('send');
	}

}

module.exports = WriteState;
