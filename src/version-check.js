const https = require('https');
const process = require('process');

const SV_RGX = /(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)/;

function countdown (ms) {
	process.stdout.write(`Continuing in ${ms/1000} seconds...\r`);
	if (ms - 100 > 0) {
		setTimeout(countdown, 10, ms - 100);
	}
}

function lessThan (semanticVersion0, semanticVersion1) {
	const v0 = semanticVersion0.match(SV_RGX);
	const v1 = semanticVersion1.match(SV_RGX);
	if (v0 !== null && v1 !== null) {
		return v0[1] < v1[1] || v0[2] < v1[2] || v0[3] < v1[3];
	}
	else {
		throw Error('Non-semantic version encountered');
	}
}

function versionCheck (url, version) {
	console.log('>checking for newer versions of STOWAWAY...');
	return new Promise(resolve => {
		const handleError = e => {
			let result = '\x1b[4m\x1b[31mERROR ENCOUNTERED WHILE VERSION CHECKING:\x1b[0m\n';
			result += `\n\x1b[31m${e.message}\x1b[0m\n`;
			result += '\x1b[43m\x1b[30mCHECK FOR NEWER RELEASES YOURSELF.\x1b[0m';
			resolve(result);
		};
		try {
			https.get(url, response => {
				let buffer = Buffer.alloc(0);
				response.on('data', data => {
					buffer = Buffer.concat([ buffer, Buffer.from(data) ]);
				});
				response.once('end', () => {
					try {
						const json = JSON.parse(buffer.toString());
						if (json.redirect != null) {
							versionCheck(json.redirect, version)
							.then(resolve);
						}
						else if (json.version != null) {
							if (lessThan(version, json.version)) {
								let result = `\x1b[42m\x1b[30mSTOWAWAY version ${json.version} available!\x1b[0m\n\n`;
								if (json.url != null) {
									result += `get the newest release from here: \x1b[4m${json.url}\x1b[0m\n`;
								}
								if (json.text != null) {
									result += json.text;
								}
								if (json.changelog != null) {
									if (json.changelog.body != null) {
										result += `\n\n${json.changelog.body}`;
									}
									if (json.changelog.list != null && Array.isArray(json.changelog.list) && json.changelog.list.length > 0) {
										result += '\n\n\x1b[4mCHANGES\x1b[0m';
										json.changelog.list[0] = '\n- ' + json.changelog.list[0];
										result += json.changelog.list.join('\n- ');
									}
								}
								resolve(result);
							}
							else {
								resolve();
							}
						}
						else {
							throw Error('No version key found in "version.json"');
						}
					}
					catch (err) {
						handleError(err);
					}
				});
			}).on('error', handleError);
		}
		catch (error) {
			handleError(error);
		}
	});
}

module.exports = versionCheck;
