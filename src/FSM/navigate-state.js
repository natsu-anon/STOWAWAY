const State = require('./state.js')
const ServerState = require('/.servers-state.js');
const DMState = require('/.dm-state.js');

class NavigateState extends State {
	constructor (serverModel, dmModel, updateFunc, subscriptions, onEsc) {
		const server = new ServerState(serverModel, updateFunc);
		server.on('enter', subscriptions.enterServer);
		server.on('exit', subscriptions.exitServer);
		this.server = server;
		const dm = new DMState(dmModel, updateFunc);
		dm.on('enter', subscriptions.enterDM);
		dm.on('exit', subscriptions.exitDM);
		this.dm = dm;
		this.current = server;
		this.serverFlag = true;
		this.onTab = swap;
		if (onEsc !== undefined) {
			this.onEsc = onEsc
		}
	}

	launch () {
		this.current.enter();
		enter();
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

	onW () {
		this.current.onW();
	}

	onA () {
		this.current.onA();
	}

	onS () {
		this.current.onS();
	}

	onD () {
		this.current.onD();
	}

	onSpace () {
		this.current.onSpace();
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
