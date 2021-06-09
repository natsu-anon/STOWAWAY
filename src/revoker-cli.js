const blessed = require('blessed');

function setupEvents(elem, keyEvents) {
	for (const key in keyEvents) {
		elem.onceKey(key, keyEvents[key]);
	}
}

function revocationForm (screen, label, keyEvents) {
	const form = blessed.form({
		parent: screen,
		tags: true,
		keys: true,
		height: 40,
		width: 120,
		top: 'center',
		left: 'center',
		label: ` {red-fg}${label}{/red-fg} `,
		padding: 1,
		border: {
			type: 'line',
			fg: 'red'
		}
	});
	blessed.text({
		parent: form,
		top: 0,
		content: 'Enter new key nickname:',
		fg: 'red',
	});
	const nickname = blessed.textbox({
		parent: form,
		top: 1,
		height: 1,
		inputOnFocus: true,
		name: 'nickname',
		content: 'nickname...',
		style: {
			fg: 'red',
			focus: {
				inverse: true
			}
		}
	});
	blessed.text({
		parent: form,
		top: 2,
		content: 'Enter new key passphrase:',
		fg: 'red',
	});
	const passphrase0 = blessed.textbox({
		parent: form,
		censor: true,
		top: 3,
		height: 1,
		inputOnFocus: true,
		name: 'passphrase0',
		content: 'passphrase...',
		style: {
			fg: 'red',
			focus: {
				inverse: true
			}
		}
	});
	blessed.text({
		parent: form,
		top: 4,
		content: 'Re-enter new key passphrase:',
		fg: 'red',
	});
	const passphrase1 = blessed.textbox({
		parent: form,
		censor: true,
		top: 5,
		height: 1,
		inputOnFocus: true,
		name: 'passphrase1',
		content: 'passphrase...',
		style: {
			fg: 'red',
			focus: {
				inverse: true
			}
		}
	});
	const button = blessed.button({
		parent: form,
		name: 'submit',
		content: ' [ REVOKE ] ',
		top: 7,
		left: 'center',
		shrink: true,
		style: {
			fg: 'red',
			focus: {
				inverse: true
			}
		}
	});
	button.on('press', () => {
		form.submit();
		screen.render();
	});
	const output = blessed.text({
		parent: form,
		top: 8,
		tags: true,
		fg: 'red',
	});
	form.focusNext();
	screen.grabKeys = false;
	screen.render();
	setupEvents(form, keyEvents);
	setupEvents(nickname, keyEvents);
	setupEvents(passphrase0, keyEvents);
	setupEvents(passphrase1, keyEvents);
	setupEvents(button, keyEvents);
	return { form, output };
}

module.exports = revocationForm;
