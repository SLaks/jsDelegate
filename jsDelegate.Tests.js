/// <reference path="jsDelegate.js" />
/// <reference path="QUnit/qunit.js" />

function argReturner(arg) { return arg; }
function thisReturner() { return this; }

var obj = { name: "Sample this" };

test("Closed delegates", function () {
	var d = Delegate.createClosed(obj, thisReturner);
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
	equal(d(8), 8);
	equal(d(8, -20), 8);
});

test("OpenThis delegates", function () {
	var d = Delegate.createOpenThis(thisReturner);
	equal(d(obj), obj);
	equal(d(obj, -20), obj);

	d = Delegate.createOpenThis(argReturner);
	ok(typeof d(-20) === "undefined", "OpenThis delegate should pass this before function arguments");
	equal(d(-20, 16), 16, "OpenThis delegate passes second argument as first parameter");
});

test("Curried delegates", function () {
	function argsReturner() {
		return Array.prototype.slice.call(arguments);
	}
	var d = Delegate.createOpen(argsReturner);
	deepEqual(d(1, 2, 3), [1, 2, 3], "Normal argsReturner delegate works");

	var c = d.curry(1);
	deepEqual(c(2), [1, 2], "Single curried argument works");
});

test("Combined delegates", function () {
	var arr;
	var pusher = Delegate.createClosed(arr, "push");

	var d = Delegate.combine(
		function () { arr = []; },
		pusher.curry(1),
		pusher.curry(2),
		pusher.curry(3)
	);
	d();
	deepEqual(arr, [1, 2, 3], "Combine executes in order");
});