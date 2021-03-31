const EventEmitter = require('events');
const ReadState = require('./read-state.js');
const WriteState = require('./write-state.js');
const NavigateState = require('./navigate-state.js');

class FSM extends EventEmitter {
	#current;
	#navigate;
	#read;
	#write;
	#member;
	#revoke;
	#about;
	#help;

	constructor (args) {
		super();
		const navigateState = new NavigateState(args.navigate);
		const readState = new ReadState(args.read);
		const writeState = new WriteState(args.write);
		this.#read.on('scroll', offset => { this.emit('scroll', offset); });
		this.#read.on('to write', () => this.write());
		this.#navigate.on('to read', enterSelected => {
			if (enterSelected) {
				this.emit('enter channel');
			}
			this.read();
		});
		this.#write.on('clear', () => {
			this.emit('clear input');
			this.read();
		});
		this.#write.on('send', () => {
			this.emit('send input');
			this.read();
		});
		this.#navigate = navigateState;
		this.#read = readState;
		this.#write = writeState;
		this.#current = navigateState;
		this.#current.enter();
		// WELCOME TO HELL
		this.ctrlC = () => { this.emit('quit'); };
		this.ctrlR = this.#current.ctrlR;
		this.ctrlA = this.#current.ctrlA;
		this.ctrlH = this.#current.ctrlH;
		this.backtick = this.#current.backtick;
		this.ctrlEnter = this.#current.ctrlEnter;
		this.enter = this.#current.enter;
		this.tab = this.#current.tab;
		this.ctrlW = this.#current.ctrlW;
		this.ctrlS = this.#current.ctrlS;
		this.w = this.#current.w;
		this.s = this.#current.s;
		this.a = this.#current.a;
		this.d = this.#current.d;
		this.ctrl0 = this.#current.ctrl0;
		this.ctrl1 = this.#current.ctrl1;
		this.ctrl2 = this.#current.ctrl2;
		this.ctrl3 = this.#current.ctrl3;
		this.ctrl4 = this.#current.ctrl4;
		this.ctrl5 = this.#current.ctrl5;
		this.ctrl6 = this.#current.ctrl6;
		this.ctrl7 = this.#current.ctrl7;
		this.ctrl8 = this.#current.ctrl8;
		this.ctrl9 = this.#current.ctrl9;
		this.num0 = this.#current.num0;
		this.num1 = this.#current.num1;
		this.num2 = this.#current.num2;
		this.num3 = this.#current.num3;
		this.num4 = this.#current.num4;
		this.num5 = this.#current.num5;
		this.num6 = this.#current.num6;
		this.num7 = this.#current.num7;
		this.num8 = this.#current.num8;
		this.num9 = this.#current.num9;
	}

	navigate () {
		this.#transition(this.#navigate);
	}

	read () {
		this.#transition(this.#read);
	}

	write (publicFlag) {
		this.#current.Exit();
		this.#current = this.#write;
		this.#current.Enter(publicFlag);
	}

	member () {
		this.#transition(this.#member);
	}

	help () {
		this.#transition(this.#help.prevState(this.#current));
	}

	about () {
		this.#transition(this.#about.prevState(this.#current));
	}

	revoke () {
		this.#transition(this.#revoke.prevState(this.#current));
	}

	#transition (state) {
		this.#current.Exit();
		this.#current = state;
		this.#current.Enter();
	}
}

module.exports = FSM;
