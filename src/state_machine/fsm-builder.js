const FSM = require('./fsm.js');

function _ () {}

class FSMBuilder {

	constructor () {
		this._navigate = { enter: _, exit: _ };
		this._handshake = { enter: _, exit: _ };
		this._read = { enter: _, exit: _ };
		this._write = { enter: _, exit: _ };
		this._member = { enter: _, exit: _ };
		this._revoke = { enter: _, exit: _ };
		this._about = { enter: _, exit: _ };
		this._keybinds = { enter: _, exit: _ };
	}

	navigate (enter, exit=_) {
		this._navigate = { enter, exit };
		return this;
	}

	handshake (enter, exit=_) {
		this._handshake = { enter, exit };
		return this;
	}

	read (enter, exit=_) {
		this._read = { enter, exit };
		return this;
	}

	write (enter, exit=_) {
		this._write = { enter, exit };
		return this;
	}

	member (enter, exit=_) {
		this._member = { enter, exit };
		return this;
	}

	revoke (enter, exit=_) {
		this._revoke = { enter, exit };
		return this;
	}

	about (enter, exit=_) {
		this._about = { enter, exit };
		return this;
	}

	keybinds (enter, exit=_) {
		this._keybinds = { enter, exit };
		return this;
	}

	build () {
		return new FSM({
			navigate: this._navigate,
			handshake: this._handshake,
			read: this._read,
			write: this._write,
			member: this._member,
			revoke: this._revoke,
			about: this._about,
			keybinds: this._keybinds
		});
	}
}

module.exports = FSMBuilder;
