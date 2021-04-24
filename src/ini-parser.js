const fs = require('fs');
const regex = /^(?<key>\w+)=(?<value>.+)$/gm;

class IniError extends Error {}

module.exports = function (file) {
	const iniText = fs.readFileSync(file, 'utf8');
	const res = {};
	let match;
	let parsed;
	while ((match = regex.exec(iniText)) !== null) {
		parsed = parseInt(match.groups.value, 10);
		try {
			if (isNaN(parsed)) {
				Object.defineProperty(res, match.groups.key, {
					value: match.groups.value,
					enumerable: true,
				});
			}
			else {
				Object.defineProperty(res, match.groups.key, {
					value: parsed,
					enumerable: true,
				});
			}
		}
		catch (err) {
			const line = iniText.substring(0, match.index).match(/\n/gm).length + 1;
			throw new IniError(`Redefined key '${match.groups.key}' at line ${line}: '${match[0]}' in ${file}`);
		}
	}
	return res;
};
