const EventEmitter = require('events');
const InputState = require('./input-state.js')
const MessageState = require('./message-state.js')
const DMState = require('./dm-state.js')
const ServersState = require('./servers-state.js')

class FSM () extends EventEmitter {
	constructor (driver) {
		this.driver = driver;
		this._servers = new ServersState();
		this._servers.on('enter', () => { this.emit('enter server'); });
		this._servers.on('exit', () => { this.emit('exit server'); });
		this._dm = new DMState();
		this._dm.on('enter', () => { this.emit('enter dm'); });
		this._dm.on('exit', () => { this.emit('exit dm'); });
		this.current = this.servers;
		this.prev = null;
	}

	// use once instead of on so that way these things remove themselves after happening ONCE
	_changeTo (state, onEnter, onExit) {
		this.current.exit();
		this.current = state;
		if (onEnter !== undefined && onExit !== undefined) {
			this.current.once('enter', onEnter);
			this.current.once('exit', onExit);
		}
		this.current.enter();
	}

	_beforeRemoveAll (func) {
		return () => {
			func();
			this.driver.removeAllListeners();
		}
	}

	launch () {
		this.current.enter();
	}

	input () {
		_changeTo(new InputState(this.current),
			() => { this.emit('enter input'); },
			() => { this.emit('exit input'); }
		);
	}

	messages () {
		if (this._messages == null) {
			_changeTo(new MessageState(this.current),
				() => { this.emit('enter messages'); },
				() => { this.emit('exit messages'); }
			);
		}
		else {
			this._messages.prevState = this.current;
			_changeTo(this._messages,
				() => { this.emit('enter messages'); },
				() => { this.emit('exit messages'); }
			);
		}
	}

	servers () {
		_changeTo(this._servers);
		this.driver.once('to dm', _beforeRemoveAll(dm));
		this.driver.once('to message', _beforeRemoveAll(messages));
	}

	dm () {
		_changeTo(this._dm);
		this.driver.once('to servers', servers); // HAHA DOESNT WORK -- think about it
		this.driver.once('to message', messages); // HAHA DOESNT WORK -- think about it
	}

}

module.exports = FSM;
