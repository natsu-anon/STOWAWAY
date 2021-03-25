const https = require('https');

const SV_RGX = /(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)/;

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
	console.log('checking for newer versions of STOWAWAY...');
	return new Promise((resolve, reject) => {
		https.get(url, response => {
			response.on('err', () => { resolve(); });
			response.on('data', data => {
				try {
					const json = JSON.parse(data.toString());
					if (json.redirect != null) {
						versionCheck(json.redirect)
						.then(resolve)
						.catch(reject);
					}
					else if (json.version != null) {
						if (lessThan(version, json.version)) {
							console.log(`STOWAWAY version ${json.version} available!`);
							if (json.text != null) {
								console.log(json.text);
							}
							if (json.changelog != null) {
								if (json.changelog.body != null) {
									console.log('\n');
									console.log(json.changelog.body);
								}
								if (json.changelog.list != null && json.changelog.list.isArray()) {
									console.log('\nCHANGES');
									console.log(json.changelog.list.join('\n- '));
								}
							}
							reject();
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
					console.log('\x1b[4m\x1b[31mERROR ENCOUNTERED WHILE VERSION CHECKING:\x1b[0m');
					console.log(`\x1b[31m${err.message}\x1b[0m`);
					console.log('\x1b[43m\x1b[30mCHECK FOR NEWER RELEASES YOURSELF.\x1b[0m');
					console.log('Continuing in 3 seconds...');
					setTimeout(resolve, 3000);
				}
			});
		});
	});
}

module.exports = versionCheck;
