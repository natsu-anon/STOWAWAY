const blessed = require('blessed');
const fs = require('fs');

class BlessedInput {
	constructor (prompt, censor) {
		let screen = blessed.screen({
			smartcsr: true,
			autopadding: true,
			dockborders:true,
			fullunicode: true,
		});
		blessed.box({
			parent: screen,
			width: '100%',
			height: '100%',
			border: { type: 'line' },
			align: "left",
			valign: "bottom",
			padding: { left: 1 },
			content: fs.readFileSync('./banner.txt', 'utf8'),
		});
		// console.log(banner);
		this.textbox;
		if (censor) {
			this.textbox = blessed.textbox({
				parent: screen,
				left: 'center',
				top: 'center',
				style: { fg: 'green' },
				tags: true,
				width: 80,
				height: 3,
				inputOnFocus: true,
				label: ` {green-fg}${prompt}{/} `,
				border: { type: 'line', fg: 'green' },
				censor: true,
			});
		}
		else {
			this.textbox = blessed.textbox({
				parent: screen,
				left: 'center',
				top: 'center',
				style: { fg: 'green' },
				tags: true,
				width: 80,
				height: 3,
				inputOnFocus: true,
				label: ` {green-fg}${prompt}{/} `,
				border: { type: 'line', fg: 'green' },
			});
		}
		this.textbox.focus();
		screen.render();
		this.screen = screen;
	}

	submission () {
		return new Promise((resolve, reject) => {
			this.textbox.once('submit', (val) => {
				this.screen.destroy();
				resolve(val);
			});
		});
	}
}

module.exports = function (prompt, censor=false) {
	return new BlessedInput(prompt, censor).submission();
}
