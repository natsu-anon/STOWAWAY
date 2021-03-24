const https = require('https');

function equals (semanticVersion0, semanticVersion1) {
	const v0 = semanticVersion0.split('.');
	const v1 = semanticVersion1.split('.');
	return v0[0] === v1[0] && v0[1] === v1[1] && v0[2] === v1[2];
}

function versionCheck (url, version) {
	return new Promise((resolve, reject) => {
		https.get(url, response => {
			response.on('err', reject);
			response.on('data', data => {
				try {
					const json = JSON.parse(data.toString());
					if (json.redirect != null) {
						versionCheck(json.redirect)
						.then(resolve)
						.catch(reject);
					}
					else if (json.version != null) {
						if (equals(version, json.version)) {
							const res = { current: false };
							if (json.text != null) {
								res.text = json.text;
							}
							if (json.changelog != null) {
								res.changelog = {};
								if (json.changelog.body != null) {
									res.changelog.body = json.changelog.body;
								}
								if (json.changelog.list != null && json.changelog.list.isArray()) {
									res.changelog.list = json.changelog.list;
								}
							}
							resolve(res);
						}
						else {
							resolve({ current: true });
						}
					}
					else {
						reject();
					}
				}
				catch (err) {
					reject(err);
				}
			});
		});
	});
}

module.exports = versionCheck;
