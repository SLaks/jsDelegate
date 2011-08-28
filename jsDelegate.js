var Delegate = (function () {
	"use strict";
	var noTarget = {};

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

	//This object holds all of the standard member 
	//functions on delegates, except for functions
	//that need closured variables.
	//I can't use a prototype because Delegate is
	//not a class; instead, delegates are regular
	//functions with special members. This allows
	//delegates to be invoked directly.
	var delegateMethods = {
		copy: function (newPrevious) {
			/// <summary>Creates a shallow copy of this delegate instance.  Only the most recent method in the delegate is copied.</summary>
			return createDelegate(this.invoker, this.method, this.target, newPrevious);
		},
		curry: function () {
			/// <summary>Creates a new delegate that passes the given parameter list to this delegate.</summary>
			var preArgs = Array.prototype.slice.call(arguments);
			var delegate = this;
			return createDelegate(function () {
				return delegate.apply(this, preArgs.concat(Array.prototype.slice.call(arguments)));
			}, delegate.method, delegate.target);
		},
		each: function (callback) {
			/// <summary>Runs a callback method on each function contained in this delegate.</summary>
			/// <param name="callback" type="Function">A callback function, taking the chained delegate
			/// instance (which calls all methods below it), and the invoker that runs this method only.</param>
			for (var i = 0; i < this.previous.length; i++) {
				this.previous[i].each(callback);
			}
			return callback(this, this.invoker);
		},
		remove: function () {
			/// <summary>Removes all of the methods in one or more delegates from this delegate, returning a new delegate (or null if there are no other methods).</summary>
		}
	};

	function isDelegate(func) {
		/// <summary>Checks whether an object is a delegate function.</summary>

		//Since delegates are regular functions, all I can do
		//is check for my special members.
		return typeof func === "function"
			&& func.curry === delegateMethods.curry
			&& typeof (func.method) === "function";
	}
	function ensureDelegate(func) {
		/// <summary>Wraps ordinary functions in delegates.</summary>
		if (typeof func !== "function")
			throw new Error("argument is not a function or delegate");
		return isDelegate(func) ? func : createDelegate(func, func, noTarget);
	}

	function createDelegate(invoker, method, target, previous) {
		if (typeof invoker !== "function")
			throw new Error("Function expected");
		if (typeof method !== "function")
			throw new Error("Function expected");
		if (arguments.length < 3)
			throw new Error("Three parameters required");
		if (previous && !(previous instanceof Array))
			throw new Error("Previous is not an array");

		var d = function delegateFunc() {
			var args = arguments;
			var target = this;

			//The delegate itself calls each delegate in its chain
			return d.each(function (delegate, invoker) {
				return invoker.apply(target, args);
			});
		};

		//The method and target fields allow clients to
		//see what a closed delegate points to. They're
		//only used for comparison purposes.
		d.method = method;
		if (target !== noTarget)
			d.target = target;
		d.invoker = invoker;
		d.previous = previous || [];

		extend(d, delegateMethods);
		return d;
	}

	return {
		isDelegate: isDelegate,
		createOpen: function (method) {
			/// <summary>Creates an open delegate that calls its target method with the same `this` object that the delegate was called with.</summary>
			return createDelegate(method, method, noTarget);
		},
		createOpenThis: function (method) {
			/// <summary>Creates an open delegate that calls its target method with `this` as the delegate's first parameter.  The first parameter of the delegate call is not passed to the function.</summary>
			return createDelegate(bind(method.call, method), method, noTarget);
		},
		createClosed: function (thisObj, method) {
			/// <summary>Creates a closed delegate that calls a method on a specific this-object.</summary>
			/// <param name="thisObj" type="Object">The instance to pass as the this parameter.</param>
			/// <param name="method" type="Function | String">The function to invoke, or the name of a member function of the object.</param>
			if (typeof method === "string")
				method = thisObj[method];
			return createDelegate(bind(method, thisObj), method, thisObj);
		},
		combine: function () {
			/// <summary>Combines multiple functions or delegates into a single delegate that calls all of the methods in order.</summary>

			var retVal = null;
			for (var i = 0; i < arguments.length; i++) {
				if (!arguments[i])
					continue;

				var next = arguments[i];
				if (!retVal)
					retVal = ensureDelegate(next);
				else if (!isDelegate(next))
					retVal = createDelegate(next, next, noTarget, [retVal]);
				else {
					var newPrevious = [retVal].concat(next.previous);
					retVal = next.copy(newPrevious);
				}
			}
			return retVal;
		}
	};
})();