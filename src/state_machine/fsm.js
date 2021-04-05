const EventEmitter = require('events');
const NavigateState = require('./navigate-state.js');
const HandshakeState = require('./handshake-state.js');
const ReadState = require('./read-state.js');
const WriteState = require('./write-state.js');
const MemberState = require('./member-state.js');
const RevokeState = require('./revoke-state.js');
const AboutState = require('./about-state.js');
const KeybindState = require('./help-state.js');

class FSM extends EventEmitter {
	#current;
	#navigate;
	#handshake;
	#read;
	#write;
	#member;
	#revoke;
	#about;
	#help;
	#noticeFunc;

	constructor (args) {
		super();
		this.#navigate = new NavigateState(args.navigate);
		this.#handshake = new HandshakeState(args.handshake);
		this.#read = new ReadState(args.read);
		this.#write = new WriteState(args.write);
		this.#member = new MemberState(args.member);
		this.#revoke = new RevokeState(args.revoke);
		this.#about = new AboutState(args.about);
		this.#help = new KeybindState(args.help);
		this.#current = this.#navigate;

		/*  WELCOME TO HELL  */

		// handle transitions
		this.#current.on('to navigate', () => { this.navigate(); });
		this.#current.on('to read', enterFlag => { this.emit('read channel', enterFlag); });
		this.#current.on('to write', this.write);
		this.#current.on('to member', () => { this.member(); });
		this.#current.on('to revoke', this.revoke);
		this.#current.on('to about', this.about);
		this.#current.on('to keybinds', this.help);
		this.#current.on('to previous', this.#transition);
		this.#current.on('to favorite', number => {
			this.emit('to favorite', number, this.read);
		});
		this.#current.on('to notification', () => {
			if (this.#noticeFunc != null) {
				this.noticeFunc();
			}
		});

		// event handling
		this.#current.on('clear favorite', () => { this.emit('clear favorite'); });
		this.#current.on('set favorite', number => { this.emit('set favorite', number); });
		this.#navigate.on('channels', next => { this.emit('navigate channels', next); });
		this.#navigate.on('servers', next => { this.emit('navigate servers', next); });
		this.#handshake.on('channels', next => { this.emit('handshake channels', next); });
		this.#handshake.on('servers', next => { this.emit('handshake servers', next); });
		this.#handshake.on('handshake', () => {
			this.emit('perform handshake');
		});
		this.#read.on('scroll', offset => { this.emit('scroll messages', offset); });
		this.#read.on('scroll top', () => { this.emit('messages top'); });
		this.#read.on('scroll bottom', () => { this.emit('messages bottom'); });
		this.#read.on('handshake', () => { this.emit('repeat handshake'); });
		this.#write.on('clear', () => {
			this.emit('clear input');
			this.read();
		});
		this.#write.on('send', () => {
			this.emit('send input');
			this.read();
		});
		this.#member.on('scroll', offset => { this.emit('scroll members', offset); });
		this.#member.on('sign member', () => { this.emit('sign member'); });
		// keybind hookups
		this.ctrlC = () => { this.emit('quit'); };
		this.ctrlR = this.#current.ctrlR;
		this.ctrlA = this.#current.ctrlA;
		this.ctrlK = this.#current.ctrlK;
		this.backtick = this.#current.backtick; // also used by delete
		this.ctrlEnter = this.#current.ctrlEnter;
		this.backspace = this.#current.backspace;
		this.enter = this.#current.enter;
		this.tab = this.#current.tab;
		this.ctrlW = this.#current.ctrlW;
		this.ctrlS = this.#current.ctrlS;
		this.w = this.#current.w;
		this.s = this.#current.s;
		this.a = this.#current.a;
		this.d = this.#current.d;
		this.h = this.#current.h;
		this.m = this.#current.m;
		this.e = this.#current.e;
		this.shift0 = this.#current.ctrl0;
		this.shift1 = this.#current.ctrl1;
		this.shift2 = this.#current.ctrl2;
		this.shift3 = this.#current.ctrl3;
		this.shift4 = this.#current.ctrl4;
		this.shift5 = this.#current.ctrl5;
		this.shift6 = this.#current.ctrl6;
		this.shift7 = this.#current.ctrl7;
		this.shift8 = this.#current.ctrl8;
		this.shift9 = this.#current.ctrl9;
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
		// schmood
		this.#current.Enter();
	}

	get current () {
		return this.#current;
	}

	set notification (func) {
		this.#noticeFunc = func;
	}

	navigate () {
		this.#transition(this.#navigate);
	}

	handshake (state) {
		this.#transition(this.#handshake.prevState(state));
	}

	read () {
		this.#transition(this.#read);
	}

	write () {
		this.#transition(this.#write);
	}

	member () {
		this.#transition(this.#member);
	}

	revoke (state) {
		this.#transition(this.#revoke, state);
	}

	about (state) {
		this.#transition(this.#about, state);
	}

	help (state) {
		this.#transition(this.#help, state);
	}

	#transition (target, previous) {
		this.#current.Exit();
		if (previous != null) {
			this.#current = target.prevState(previous);
			this.#current.Enter(previous);
		}
		else {
			this.#current = target;
			this.#current.Enter();
		}
	}
}

module.exports = FSM;
