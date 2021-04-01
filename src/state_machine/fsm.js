const EventEmitter = require('events');
const NavigateState = require('./navigate-state.js');
const HandshakeState = require('./handshake-state.js');
const ReadState = require('./read-state.js');
const WriteState = require('./write-state.js');
const MemberState = require('./member-state.js');
const RevokeState = require('./revoke-state.js');
const AboutState = require('./about-state.js');
const HelpState = require('./help-state.js');

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
		this.#help = new HelpState(args.help);
		this.#current = this.#navigate;

		/*  WELCOME TO HELL  */

		// handle transitions
		this.#current.on('to navigate', () => { this.navigate(); });
		this.#current.on('to read', enterFlag => { this.emit('read channel', enterFlag); });
		this.#current.on('to write', this.write);
		this.#current.on('to member', () => { this.member(); });
		this.#current.on('to revoke', this.revoke);
		this.#current.on('to about', this.about);
		this.#current.on('to help', this.help);
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
			this.emit('handshake channel');
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
		this.ctrlQ = this.#current.ctrlH;
		this.backtick = this.#current.backtick;
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
		// schmood
		this.#current.enter();
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

	#transition (state0, state1=null) {
		this.#current.Exit();
		if (state1 != null) {
			this.#current = state1.prevState(state0);
			this.#current.Enter(state0);
		}
		else {
			this.#current = state0;
			this.#current.Enter();
		}
	}
}

module.exports = FSM;
