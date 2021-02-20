class Node {
	constructor (id) {
		this.id = id;
		this.parent = null;
	}

	find (id) {
		if (this.id == id) {
			return { success: true, value: this };
		}
		else {
			return { success: false };
		}
	}

	remove (id) {
		return false;
	}

	foreach (func) {
		func(this);
	}
}

class ParentNode extends Node {
	constructor (id) {
		super(id);
		this.children = [];
	}

	addChild (node) {
		this.children.push(node);
		node.parent = this;
	}

	find (id) {
		if (this.id == id) {
			return { success: true, value: this };
		}
		else {
			var temp;
			for (let i = 0; i < children.length; i++) {
				temp = this.children[i].find(id);
				if (temp.success) {
					return { success: true, value: this };
				}
			}
			return { success: false };
		}
	}

	remove (id) {
		for (let i = this.children.length - 1; i > -1; i--) {
			if (this.children[i].id == id) {
				this.children.splice(i);
				return true;
			}
			else if (this.children[i].remove(id)) {
				return true;
			}
		}
		return false;
	}

	foreach (func) {
		func(this);
		for (let i = 0; i < this.children.length; i++) {
			this.children[i].foreach(func);
		}
	}
}

class RootNode {
	constructor (id) {
		this.id = id;
		this.children = []
	}

	addChild (node) {
		this.children.push(node);
		node.parent = this;
	}

	find (id) {
		var temp;
		for (let i = 0; i < this.children.length; i++) {
			temp = this.children[i].find(id);
			if (temp.success) {
				return temp.value;
			}
		}
		return null;
	}

	remove (id) {
		for (let i = this.children.length - 1; i > -1; i--) {
			if (this.children[i].id == id) {
				this.children.splice(i);
				return;
			}
			else if (this.children[i].remove(id)) {
				return;
			}
		}
	}

	foreach (func) {
		func(this);
		for (let i = 0; i < this.children.length; i++) {
			this.children[i].foreach(func);
		}
	}
}

module.exports = {
	Node: Node,
	ParentNode: ParentNode,
	RootNode: RootNode,
};
