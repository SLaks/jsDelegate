var Delegate = (function () {
	"use strict";
	function bind(func, s) {
		return function () { return func.apply(s, arguments); };
	}

	function extend(target, source) {
		for (var cProp in source)
			if (source.hasOwnProperty(cProp))
				target[cProp] = source[cProp];

		//Work around IE bug (toString & valueOf aren't enumerated)
		if (source.hasOwnProperty("toString"))
			target.toString = source.toString;
		if (source.hasOwnProperty("valueOf"))
			target.valueOf = source.valueOf;

		return target;
	}

	var delegateMethods = {
		curry: function () {
			var preArgs = Array.prototype.slice.call(arguments);
			var delegate = this;
			return createDelegate(function () {
				return delegate.apply(this, preArgs.concat(Array.prototype.slice.call(arguments)));
			}, delegate.method);
		},
		each: function (callback) {
			for (var i = 0; i < this.previous.length; i++) {
				this.previous[i].each(callback);
			}
			return callback(this, this.invoker);
		}
	};
	function isDelegate(func) {
		return typeof func === "function" && func.curry === delegateMethods.curry && typeof (func.push) === "function" && typeof (func.method) === "function";
	}
	function ensureDelegate(func) {
		if (typeof func !== "function")
			throw new Error("argument is not a function or delegate");
		return isDelegate(func) ? func : createDelegate(func, func);
	}

	function createDelegate(invoker, method, previous) {
		if (typeof invoker !== "function")
			throw new Error("Function expected");
		if (typeof method !== "function")
			throw new Error("Function expected");
		if (previous && !(previous instanceof Array))
			throw new Error("Previous is not an array");

		var d = function delegateFunc() {
			var args = arguments;
			var target = this;

			return d.each(function (delegate, invoker) {
				return invoker.apply(target, args);
			});
		};

		d.method = method;
		d.invoker = invoker;
		extend(d, delegateMethods);

		d.copy = function (newPrevious) {
			return createDelegate(invoker, method, newPrevious);
		};

		d.previous = previous || [];
		return d;
	}

	return {
		isDelegate: isDelegate,
		createOpen: function (method) {
			return createDelegate(method, method);
		},
		createOpenThis: function (method) {
			return createDelegate(bind(method.call, method), method);
		},
		createClosed: function (thisObj, method) {
			if (typeof method === "string")
				method = thisObj[method];
			return createDelegate(bind(method, thisObj), method);
		},
		combine: function () {
			var retVal = null;
			for (var i = 0; i < arguments.length; i++) {
				if (!arguments[i])
					continue;

				var next = arguments[i];
				if (!retVal)
					retVal = ensureDelegate(next);
				else if (!isDelegate(next))
					retVal = createDelegate(next, next, [retVal]);
				else {
					var newPrevious = [retVal].concat(next.previous);
					retVal = next.copy(newPrevious);
				}
			}
			return retVal;
		}
	};
})();