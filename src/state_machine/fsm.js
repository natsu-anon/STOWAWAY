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

	constructor (args) {
		super();
		this._navigate = new NavigateState(args.navigate);
		this._handshake = new HandshakeState(args.handshake);
		this._read = new ReadState(args.read);
		this._write = new WriteState(args.write);
		this._member = new MemberState(args.member);
		this._revoke = new RevokeState(args.revoke);
		this._about = new AboutState(args.about);
		this._keybinds = new KeybindState(args.keybinds);

		/*  WELCOME TO HELL  */

		const states = [
			this._navigate,
			this._handshake,
			this._read,
			this._write,
			this._member,
			// this._revoke, handle its transitions 
			this._about,
			this._keybinds
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
			state.on('to previous', s => { this._transition(s); });
			state.on('to favorite', number => {
				this.emit('to favorite', number);
			});
			state.on('to notification', () => {
				if (this._noticeFunc != null) {
					this.noticeFunc();
				}
			});
			// event handling
			state.on('clear favorite', () => { this.emit('clear favorite'); });
			state.on('set favorite', number => { this.emit('set favorite', number); });
		});
		this._navigate.on('channels', next => { this.emit('navigate channels', next); });
		this._navigate.on('servers', next => { this.emit('navigate servers', next); });
		this._navigate.on('set favorite', number => { this.emit('set favorite', true, number); });
		this._navigate.on('clear favorite', () => { this.emit('clear favorite', true); });
		this._handshake.on('channels', next => { this.emit('handshake channels', next); });
		this._handshake.on('servers', next => { this.emit('handshake servers', next); });
		this._handshake.on('handshake', () => { this.emit('perform handshake'); });
		this._read.on('scroll', offset => { this.emit('scroll messages', offset); });
		this._read.on('scroll top', () => { this.emit('messages top'); });
		this._read.on('scroll bottom', () => { this.emit('messages bottom'); });
		this._read.on('handshake', () => { this.emit('repeat handshake'); });
		this._read.on('set favorite', number => { this.emit('set favorite', false, number); });
		this._navigate.on('clear favorite', () => { this.emit('clear favorite', false); });
		this._write.on('clear', () => { this.emit('clear input'); });
		this._member.on('scroll', next => { this.emit('scroll members', next); });
		this._member.on('sign member', () => { this.emit('sign member'); });
		this._revoke.on('to previous', s => {
			if (this.revokeFree()) {
				this._transition(s);
			}
		});
		this._revoke.on('to about', s => {
			if (this.revokeFree()) {
				this.about(s);
			}
		});
		this._revoke.on('to keybinds', s => {
			if (this.revokeFree()) {
				this.keybinds(s);
			}
		});
		this._current = this._navigate;
		this._current.Enter();
		this.revokeUnlock();
	}

	get current () {
		return this._current;
	}

	set notification (func) {
		this._noticeFunc = func;
	}

	navigate () {
		this._transition(this._navigate);
	}

	handshake (state) {
		this._transition(this._handshake, state);
	}

	read () {
		this._current.Exit();
		this._current = this._read;
		this._current.Enter();
	}

	write (publicFlag) {
		this._current.Exit();
		this._current = this._write;
		this._current.Enter(publicFlag);
	}

	member (args) {
		this._current.Exit();
		this._current = this._member;
		this._current.Enter(args);
	}

	revoke (state) {
		this._transition(this._revoke, state);
	}

	about (state) {
		this._transition(this._about, state);
	}

	keybind (state) {
		this._transition(this._keybinds, state);
	}

	revokeLock () {
		this.allowRevokeTransitions = false;
	}

	revokeUnlock () {
		this.allowRevokeTransitions = true;
	}

	revokeFree () {
		return this.allowRevokeTransitions;
	}

	ctrlC () { this.emit('quit'); }

	ctrlR () { this._current.ctrlR(); }

	ctrlA () { this._current.ctrlA(); }

	ctrlK () { this._current.ctrlK(); }

	escape () { this._current.escape(); }

	backtick () { this._current.backtick(); }

	ctrlEnter() { this._current.ctrlEnter(); }

	enter () { this._current.enter(); }

	backspace () { this._current.backspace(); }

	tab () { this._current.tab(); }

	ctrlW () { this._current.ctrlW(); }

	ctrlS () { this._current.ctrlS(); }

	// e () { this._current.e(); }

	h () { this._current.h(); }

	m () { this._current.m(); }

	w () { this._current.w(); }

	s () { this._current.s(); }

	a () { this._current.a(); }

	d () { this._current.d(); }

	shift0 () { this._current.shift0(); }

	shift1 () { this._current.shift1(); }

	shift2 () { this._current.shift2(); }

	shift3 () { this._current.shift3(); }

	shift4 () { this._current.shift4(); }

	shift5 () { this._current.shift5(); }

	shift6 () { this._current.shift6(); }

	shift7 () { this._current.shift7(); }

	shift8 () { this._current.shift8(); }

	shift9 () { this._current.shift9(); }

	num0 () { this._current.num0(); }

	num1 () { this._current.num1(); }

	num2 () { this._current.num2(); }

	num3 () { this._current.num3(); }

	num4 () { this._current.num4(); }

	num5 () { this._current.num5(); }

	num6 () { this._current.num6(); }

	num7 () { this._current.num7(); }

	num8 () { this._current.num8(); }

	num9 () { this._current.num9(); }

	_transition (target, previous) {
		this._current.Exit();
		if (previous != null) {
			target.previousState = previous;
			this._current = target;
			this._current.Enter(previous);
		}
		else {
			this._current = target;
			this._current.Enter();
		}
	}
}

module.exports = FSM;
