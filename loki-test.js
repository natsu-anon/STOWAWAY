// TODO see https://github.com/techfort/LokiJS
const loki = require('lokijs');
var db = new loki('sandbox.db');

// Add a collection to the database
var items = db.addCollection('items');

// Add some documents to the collection
items.insert({ name : 'mjolnir', owner: 'thor', maker: 'dwarves' });
items.insert({ name : 'gungnir', owner: 'odin', maker: 'elves' });
items.insert({ name : 'tyrfing', owner: 'Svafrlami', maker: 'dwarves' });
items.insert({ name : 'draupnir', owner: 'odin', maker: 'elves' });

// Find and update an existing document
var tyrfing = items.findOne({name: 'tyrfing'});
tyrfing.owner = 'arngrim';
items.update(tyrfing);

// These statements send to Text Output
console.log(('tyrfing value :'));
// logObject(tyrfing);
console.log(tyrfing);
console.log('odins items');
console.log(items.find({ owner: 'odin' }));
console.log('owner exists');
console.log(items.find({ owner: { $exists: true } }));
// console.log('odins 1st item');
// console.log(items.findOne({ 'owner': 'odin' }));
// console.log(items.data);

// This statement sends to Inspector
// inspectObject(db);
// console.log(db);
