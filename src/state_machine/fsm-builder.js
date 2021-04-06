const FSM = require('./fsm.js');

function _ () {}

class FSMBuilder {
	#navigate;
	#handshake;
	#read;
	#write;
	#member;
	#revoke;
	#about;
	#keybinds;

	constructor () {
		this.#navigate = { enter: _, exit: _ };
		this.#handshake = { enter: _, exit: _ };
		this.#read = { enter: _, exit: _ };
		this.#write = { enter: _, exit: _ };
		this.#member = { enter: _, exit: _ };
		this.#revoke = { enter: _, exit: _ };
		this.#about = { enter: _, exit: _ };
		this.#keybinds = { enter: _, exit: _ };
	}

	navigate (enter, exit=_) {
		this.#navigate = { enter, exit };
		return this;
	}

	handshake (enter, exit=_) {
		this.#handshake = { enter, exit };
		return this;
	}

	read (enter, exit=_) {
		this.#read = { enter, exit };
		return this;
	}

	write (enter, exit=_) {
		this.#read = { enter, exit };
		return this;
	}

	member (enter, exit=_) {
		this.#member = { enter, exit };
		return this;
	}

	revoke (enter, exit=_) {
		this.#revoke = { enter, exit };
		return this;
	}

	about (enter, exit=_) {
		this.#about = { enter, exit };
		return this;
	}

	keybinds (enter, exit=_) {
		this.#keybinds = { enter, exit };
		return this;
	}

	build () {
		return new FSM({
			navigate: this.#navigate,
			handshake: this.#handshake,
			read: this.#read,
			write: this.#write,
			member: this.#member,
			revoke: this.#revoke,
			about: this.#about,
			keybinds: this.#keybinds
		});
	}
}

module.exports = FSMBuilder;
