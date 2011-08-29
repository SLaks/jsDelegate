/// <reference path="jsDelegate.js" />
/// <reference path="QUnit/qunit.js" />

function argReturner(arg) { return arg; }
function thisReturner() { return this; }

var obj = { name: "Sample this" };

test("Closed delegates", function () {
	var d = Delegate.createClosed(obj, thisReturner);
	equal(d.method, thisReturner);
	equal(d.target, obj);
	equal(d(), obj);
	equal(d(-20), obj);

	d = Delegate.createClosed([1, 2, 3], "join");
	equal(d.method, Array.prototype.join, "Create closed delegate by method name");
	equal(d(','), "1,2,3");
});
test("Open delegates", function () {
	var d = Delegate.createOpen(thisReturner);
	equal(d(-20), window, "Open delegate passes no this");

	d = Delegate.createOpen(argReturner);
	equal(d.method, argReturner);
	ok(!d.hasOwnProperty("target"), "Open delegates have no target");
	equal(d(8), 8);
	equal(d(8, -20), 8);
});

test("OpenThis delegates", function () {
	var d = Delegate.createOpenThis(thisReturner);
	equal(d(obj), obj);
	equal(d(obj, -20), obj);

	d = Delegate.createOpenThis(argReturner);
	equal(d.method, argReturner);
	ok(!d.hasOwnProperty("target"), "Open delegates have no target");
	ok(typeof d(-20) === "undefined", "OpenThis delegate should pass this before function arguments");
	equal(d(-20, 16), 16, "OpenThis delegate passes second argument as first parameter");
});

test("isDelegate", function () {
	strictEqual(false, Delegate.isDelegate(null), "Null isn't a delegate");
	strictEqual(false, Delegate.isDelegate(42), "42 isn't a delegate");
	strictEqual(false, Delegate.isDelegate(function () { }), "Normal function isn't a delegate");

	ok(Delegate.isDelegate(Delegate.createClosed([], "join")), "Closed delegate is a delegate");
	ok(Delegate.isDelegate(Delegate.combine(Function, Array)), "Closed delegate is a delegate");
});

test("Curried delegates", function () {
	function argsReturner() {
		return Array.prototype.slice.call(arguments);
	}
	var d = Delegate.createOpen(argsReturner);
	deepEqual(d(1, 2, 3), [1, 2, 3], "Normal argsReturner delegate works");

	var c = d.curry(1);
	deepEqual(c(2), [1, 2], "Single curried argument works");
	equal(c.method, d.method);
});

test("Combined delegates", function () {
	var arr = [];
	var pusher = Delegate.createClosed(arr, "push");

	var d = Delegate.combine(
		function () { arr.splice(0); }, //Clear the array
		pusher.curry(1),
		pusher.curry(2),
		pusher.curry(3)
	);
	d();
	deepEqual(arr, [1, 2, 3], "Combine executes in order");

	d = Delegate.combine(
		d,
		pusher.curry(4),
		Delegate.combine(pusher.curry(5), pusher.curry(6))
	);
	d();
	deepEqual(arr, [1, 2, 3, 4, 5, 6], "Multiple chains combine correctly");
});
test("Pop", function () {
	strictEqual(Delegate.createOpen(Object).pop(), null, "Popping single delegate returns null");

	var arr = [];

	var base = Delegate.combine(
		function init() { arr = []; },
		function a1() { arr.push(1); }
	);

	base.pop()();
	deepEqual(arr, []);

	Delegate.combine(
		base,
		Delegate.combine(
			function () { arr.push(2); },
			function () { arr.push(3); },
			function () { arr.push(4); }
		)
	).pop()();
	deepEqual(arr, [1, 2, 3]);

});
test("Remove", function () {
	var arr = [];

	var base = Delegate.combine(
		function init() { arr = []; },
		function a1() { arr.push(1); }
	);

	strictEqual(base.remove(base), null, "Removing entire self returns null");
	strictEqual(base.remove("q"), base, "Removing non-existent method returns original delegate");

	strictEqual(Delegate.combine(base, Array, base).remove(Delegate.combine(base, Array, base)), null, "Removing self returns null even with duplicates");

	var withDups = Delegate.combine(base, function () { arr.push(2); }, base.method);
	withDups();
	deepEqual(arr, [1, 2, 1]);
	withDups.remove("a1")();
	deepEqual(arr, [1, 2], "Remove removes first match");
	withDups.removeAll("a1")();
	deepEqual(arr, [2], "RemoveAll removes all matches");

	var methods1 = Delegate.combine(
		function a2() { arr.push(2); },
		function a3() { arr.push(3); },
		function a4() { arr.push(4); }
	);
	var four = Delegate.combine(base, methods1);

	four();
	deepEqual(arr, [1, 2, 3, 4]);

	four.remove(methods1.method)();
	deepEqual(arr, [1, 2, 3]);

	four.remove("a2", "a1")();
	deepEqual(arr, [3, 4]);
});