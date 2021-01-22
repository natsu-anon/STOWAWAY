const Database = require('./database.js');

const db = Database.Init()
.then(() => { console.log("\n#### DONE! ####"); })
.catch((err) => { console.error(err); })
