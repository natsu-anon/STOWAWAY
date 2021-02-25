const EventEmitter = require('events');
const ReadState = require('./read-state.js');
const WriteState = require('./write-state.js');

class SingleFSM extends EventEmitter {
	constructor (enterRead, enterWrite, exitRead, exitWrite) {
		super();
		this._enterRead = enterRead;
		this._enterWrite = enterWrite;
		this._exitRead = exitRead;
		this._enterWrite = enterWrite;
		const read = new ReadState(this);
		read.on('quit', () => this.emit('quit'));
		read.on('scroll up', () => this.emit('scroll up'));
		read.on('scroll down', () => this.emit('scroll down'));
		this._readState = read;
		const write = new WriteState(this);
		write.on('clear', () => this.emit('clear input'));
		write.on('pause', () => this.emit('pause input'));
		write.on('send', () => this.emit('send input'));
		this._writeState = write;
		_read();
	}

	_write () {
		this._exitRead();
		this._current = this._writeState;
		this._enterWrite();
	}

	_read () {
		this._exitWrite();
		this._current = this._readState;
		this._enterRead();
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

module.export = SingleFSM;
