class CLIState {
}

class WriteState : CLIState {
	constructor (lastState) {
		this.lastState = lastState;
	}
}

class ReadState : CLIState {
}

class NavigateState : CLIState {
}
