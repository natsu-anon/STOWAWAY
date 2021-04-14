const EventEmitter = require('events');
const NavigateState = require('./navigate-state.js');
const HandshakeState = require('./handshake-state.js');
const ReadState = require('./read-state.js');
const WriteState = require('./write-state.js');
const MemberState = require('./member-state.js');
const RevokeState = require('./revoke-state.js');
const AboutState = require('./about-state.js');
const KeybindState = require('./keybind-state.js');

class FSM extends EventEmitter {
	#current;
	#navigate;
	#handshake;
	#read;
	#write;
	#member;
	#revoke;
	#about;
	#keybinds;
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
		this.#keybinds = new KeybindState(args.keybinds);

		/*  WELCOME TO HELL  */

		const states = [
			this.#navigate,
			this.#handshake,
			this.#read,
			this.#write,
			this.#member,
			this.#revoke,
			this.#about,
			this.#keybinds
		];
		// these work for all states (except for the last 3 but w/e)
		states.forEach(state => {
			state.on('to navigate', () => { this.navigate(); });
			state.on('to handshake', s => { this.handshake(s); });
			state.on('to read', enterFlag => { this.emit('read channel', enterFlag); });
			state.on('to write', publicFlag => { this.write(publicFlag); });
			state.on('to member', () => { this.emit('channel members'); });
			state.on('to revoke', s => { this.revoke(s); });
			state.on('to about', s => { this.about(s); });
			state.on('to keybinds', s => { this.keybind(s); });
			state.on('to previous', s => { this.#transition(s); });
			state.on('to favorite', number => {
				this.emit('to favorite', number, this.read);
			});
			state.on('to notification', () => {
				if (this.#noticeFunc != null) {
					this.noticeFunc();
				}
			});
			// event handling
			state.on('clear favorite', () => { this.emit('clear favorite'); });
			state.on('set favorite', number => { this.emit('set favorite', number); });
		});
		this.#navigate.on('channels', next => { this.emit('navigate channels', next); });
		this.#navigate.on('servers', next => { this.emit('navigate servers', next); });
		this.#handshake.on('channels', next => { this.emit('handshake channels', next); });
		this.#handshake.on('servers', next => { this.emit('handshake servers', next); });
		this.#handshake.on('handshake', () => { this.emit('perform handshake'); });
		this.#read.on('scroll', offset => { this.emit('scroll messages', offset); });
		this.#read.on('scroll top', () => { this.emit('messages top'); });
		this.#read.on('scroll bottom', () => { this.emit('messages bottom'); });
		this.#read.on('handshake', () => { this.emit('repeat handshake'); });
		this.#write.on('clear', () => { this.emit('clear input'); });
		this.#member.on('scroll', next => { this.emit('scroll members', next); });
		this.#member.on('sign member', () => { this.emit('sign member'); });
		this.#current = this.#navigate;
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
		this.#transition(this.#handshake, state);
	}

	read (args) {
		this.#current.Exit();
		this.#current = this.#read;
		this.#current.Enter(args);
	}

	write (publicFlag) {
		this.#current.Exit();
		this.#current = this.#write;
		this.#current.Enter(publicFlag);
	}

	member (args) {
		this.#current.Exit();
		this.#current = this.#member;
		this.#current.Enter(args);
	}

	revoke (state) {
		this.#transition(this.#revoke, state);
	}

	about (state) {
		this.#transition(this.#about, state);
	}

	keybind (state) {
		this.#transition(this.#keybinds, state);
	}

	ctrlC () { this.emit('quit'); }

	ctrlR () { this.#current.ctrlR(); }

	ctrlA () { this.#current.ctrlA(); }

	ctrlK () { this.#current.ctrlK(); }

	escape () { this.#current.escape(); }

	backtick () { this.#current.backtick(); }

	ctrlEnter() { this.#current.ctrlEnter(); }

	enter () { this.#current.enter(); }

	backspace () { this.#current.backspace(); }

	tab () { this.#current.tab(); }

	ctrlW () { this.#current.ctrlW(); }

	ctrlS () { this.#current.ctrlS(); }

	e () { this.#current.e(); }

	w () { this.#current.w(); }

	s () { this.#current.s(); }

	a () { this.#current.a(); }

	d () { this.#current.d(); }

	shift0 () { this.#current.shift0(); }

	shift1 () { this.#current.shift1(); }

	shift2 () { this.#current.shift2(); }

	shift3 () { this.#current.shift3(); }

	shift4 () { this.#current.shift4(); }

	shift5 () { this.#current.shift5(); }

	shift6 () { this.#current.shift6(); }

	shift7 () { this.#current.shift7(); }

	shift8 () { this.#current.shift8(); }

	shift9 () { this.#current.shift9(); }

	num0 () { this.#current.num0(); }

	num1 () { this.#current.num1(); }

	num2 () { this.#current.num2(); }

	num3 () { this.#current.num3(); }

	num4 () { this.#current.num4(); }

	num5 () { this.#current.num5(); }

	num6 () { this.#current.num6(); }

	num7 () { this.#current.num7(); }

	num8 () { this.#current.num8(); }

	num9 () { this.#current.num9(); }

	#transition (target, previous) {
		this.#current.Exit();
		if (previous != null) {
			target.previousState = previous;
			this.#current = target;
			this.#current.Enter(previous);
		}
		else {
			this.#current = target;
			this.#current.Enter();
		}
	}
}

module.exports = FSM;
