// TODO see https://github.com/techfort/LokiJS
const loki = require('lokijs');
const db = new loki('sandbox.db');

// Add a collection to the database
const items = db.addCollection('items');

// Add some documents to the collection
items.insert({ name : 'mjolnir', owner: 'thor', maker: 'dwarves' });
items.insert({ name : 'gungnir', owner: 'odin', maker: 'elves' });
items.insert({ name : 'tyrfing', owner: 'Svafrlami', maker: 'dwarves' });
items.insert({ name : 'draupnir', owner: 'odin', maker: 'elves' });

// Find and update an existing document
const tyrfing = items.findOne({ name: 'tyrfing' });
tyrfing.owner = 'arngrim';
items.update(tyrfing);

console.log(('tyrfing value :'));
console.log(tyrfing);
console.log('odins items');
console.log(items.find({ owner: 'odin' }));

console.log('length of matches for maker: dwarves');
console.log(items.find({ maker: 'dwarves' }).length);


console.log('count test');
console.log(`${items.count()} documents in items collection`);

console.log('new key test');
tyrfing.style = 'nordic';
items.update(tyrfing);
console.log(items.findOne({ name: 'tyrfing' }));

console.log('remove a key');
delete tyrfing.style;
items.update(tyrfing);
console.log(items.findOne({ name: 'tyrfing' }));


console.log('removing a document');
items.insert({ name: 'foo' });
const foo = items.findOne({ name: 'foo' });
console.log(foo);
items.remove(foo);
console.log(items.data);

// console.log(tyrfing);
// console.log('odins 1st item');
// console.log(items.findOne({ 'owner': 'odin' }));
// console.log(items.data);

// This statement sends to Inspector
// inspectObject(db);
// console.log(db);
