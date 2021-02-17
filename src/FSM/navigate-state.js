const State = require('./state.js')
const ServerState = require('/.servers-state.js');
const DMState = require('/.dm-state.js');

class NavigateState extends State {
	constructor (subscriptions) {
		const server = new ServerState();
		server.on('enter', subscriptions.enterServer);
		server.on('exit', subscriptions.exitServer);
		this.server = server;
		const dms = new DMState();
		dms.on('enter', subscriptions.enterDMs);
		dms.on('exit', subscriptions.exitDMs);
		this.dms = dms;
		this.current = server;
		this.serverFlag = true;
	}

	enter () {
		this.emit('enter');
	}

	exit () {
		this.emit('exit');
	}

	swap () {
		this.current.exit();
		this.current = this.serverFlag ? this.dm : this.server;
		this.serverFlag = !this.serverFlag;
		this.current.enter();
	}

	/* Don't think I need these
	serverState () {
		if (!this.serverFlag) {
			swap();
		}
	}

	dmState () {
		if (this.serverFlag) {
			swap();
		}
	}
	*/
}

module.exports = NavigateState;
