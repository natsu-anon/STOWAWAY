const HFSM = require('./hfsm.js');

class Builder {
	set navigateUpdate (value) {
		this._navigateUpdate = value;
	}

	set serverModel (value) {
		this._serverModel = value;
	}

	set dmModel (value) {
		this._dmModel = value;
	}

	set enterNavigate (value) {
		this._enterNavigate = value;
		return this;
	}

	set exitNavigate (value) {
		this._exitNavigate = value;
		return this;
	}

	set enterNavServer (value) {
		this._enterNavServer = value;
		return this;
	}

	set exitNavServer (value) {
		this._exitNavServer = value;
		return this;
	}

	set enterNavDM (value) {
		this._enterNavDM = value;
		return this;
	}

	set exitNavDM (value) {
		this._exitNavDm = value;
		return this;
	}

	set enterMessage (value) {
		this._enterMessage = value;
		return this;
	}

	set exitMessage (value) {
		this._exitMessage = value;
		return this;
	}

	set enterInput (value) {
		this._enterInput = value;
		return this;
	}

	set exitInput (value) {
		this._exitInput = value;
		return this;
	}

	build () {
		const hfsm =  new HFSM({
			enterServer: this._enterNavServer,
			exitServer: this._exitNavServer,
			enterDM: this._enterNavDM,
			exitDM: this._exitNavDM
		});
		hfsm.on('enter message', this._enterMessage);
		hfsm.on('exit message', this._exitMessage);
		hfsm.on('enter input', this._enterInput);
		hfsm.on('exit message', this._exitInput);
		hfsm.launch();
		reutrn hfsm;
	}
}

module.exports = Builder;
