const p1 = Promise.resolve();
const p2 = Promise.resolve(4);
const p3 = Promise.resolve(9);

Promise.all([p1, p2, p3])
.then(res => console.log(res));
Promise.all([p1, p2, p3])
.then(res => {
	console.log(res.filter(x => x != undefined));
});


Promise.resolve({ writeFlag: true, value: 20 })
.finally(() => { return 10; })
.then(console.log);
