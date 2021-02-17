const EventEmitter = require('events');
const InputState = require('./input-state.js')
const NavigateState = require('./navigate-state.js');

// NO DRIVER
class FSM () extends EventEmitter {
	constructor (subscriptions) {
		this._navigate = new NavigateState({
			enterServer: subscriptions.enterServer,
			exitServer: subscriptions.exitServer,
			enterDMs: subscriptions.enterDMs,
			exitDMs: subscriptions.exitDMs
		});
		this._navigate.on('enter', subscriptions.enterNavigation)
		this._navigate.on('exit', subscriptions.exitNavigation)
		this.current = this._navigate;
		this.current.enter();
		this.prev = null;
		this.enterInput = subscriptions.enterInput;
		this.exitInput = subscriptions.exitInput;
		this.enterMessage = subscriptions.enterMessage;
		this.exitMessage = subscriptions.exitMessage;
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

	launch () {
		this.current.enter();
	}

	input () {
		_changeTo(new InputState(this.current), this.enterInput, this.exitInput);
	}

	messages () {
		if (this._messages == null) {
			_changeTo(new MessageState(this.current), this.enterMessage, this.exitMessage);
		}
		else {
			this._messages.prevState = this.current;
			_changeTo(this._messages, this.enterMessage, this.exitMessage
				() => { this.emit('enter messages'); },
				() => { this.emit('exit messages'); }
			);
		}
	}

	swapNavigation () {
		this._navigation.swap();
	}

}

module.exports = FSM;
