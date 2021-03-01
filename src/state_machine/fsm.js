const EventEmitter = require('events');
const ReadState = require('./read-state.js');
const WriteState = require('./write-state.js');

class SingleFSM extends EventEmitter {
	constructor (enterRead, enterWrite, exitRead, exitWrite) {
		super();
		const read = new ReadState(enterRead, exitRead);
		this._readState = read;
		const write = new WriteState(enterWrite, exitWrite);
		this._writeState = write;
		this._current = this._readState;
		this._current.enter();
		read.on('quit', () => this.emit('quit'));
		write.on('quit', () => this.emit('quit')); // Comment this out?
		read.on('scroll', offset => { this.emit('scroll', offset); });
		read.on('to write', () => this._write());
		write.on('clear', () => {
			this.emit('clear input');
			this._read();
		});
		write.on('pause', () => {
			this.emit('pause input');
			this._read();
		});
		write.on('send', () => {
			this.emit('send input');
			this._read();
		});
	}

	_write () {
		this._current.exit();
		this._current = this._writeState;
		this._current.enter();
	}

	_read () {
		this._current.exit();
		this._current = this._readState;
		this._current.enter();
	}

	onCtrlC () {
		this._current.onCtrlC();
	}

	onEnter () {
		this._current.onEnter();
	}

	onEsc () {
		this._current.onEsc();
	}

	onTab () {
		this._current.onTab();
	}

	onSpace () {
		this._current.onSpace();
	}

	onW () {
		this._current.onW();
	}

	onS () {
		this._current.onS();
	}
}

module.exports = SingleFSM;
