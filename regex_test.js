const text = "#### HANDSHAKE_0 1234 ####";
const regex = /#### HANDSHAKE_0 (?<id>\d*) ####/g;
const found = regex.exec(text);
console.log(found.groups.id);
