const Datastore = require('nedb');
const db = new Datastore();
/*
const db = new Datastore({
	filename: './foo.db',
	autoload: true,
	onload : (err) => {
		if (err !== null) {
			console.error('load error', err);
		}
	},
});
*/
// console.log(db);
new Promise((resolve, reject) => {
	db.findOne({ peers: { $exists: true } }, (err, doc) => {
		if (err !== null) {
			reject(err);
		}
		else {
			resolve(doc !== null);
		}
	});
})
	.then(res => {
		console.log(res ? "found peers" : "no peers");
	});

db.insert({
	profiles: [],
});

db.insert({
	peers: [ { name : "bruh" } ],
});

new Promise((resolve, reject) => {
	db.findOne({ peers: { $exists: true } }, (err, doc) => {
		if (err !== null) {
			console.error("find error", err);
		}
		else {
			resolve(doc !== null);
		}
	});
})
	.then(res => {
		console.log(res ? "found peers" : "no peers");
	});
