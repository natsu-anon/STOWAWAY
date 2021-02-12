const text = "#### HANDSHAKE_0 1234 ####";
const regex = /#### HANDSHAKE_0 (?<id>\d*) ####/;
console.log(text.match(regex));
let found = regex.exec(text);
console.log(found.groups.id);
found = regex.exec(text);
console.log(found.groups.id);
