const EventEmitter = require('events');

class Model extends EventEmitter {
	constructor () {
		super();
		if (new.target === Model) {
			throw new TypeError('Abstract class "Model" cannot be instantiated directly');
		}
	}
}

module.exports = {
	Model,
	ChannelsModel: require('./channels-model.js'),
	HandshakedModel: require('./handshaked-model.js')
	MessagesModel: require('./messages-model.js')
};
