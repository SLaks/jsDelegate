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

		pop: function () {
			/// <summary>Returns a copy of this delegate with the last (most recently added) method removed, or null if there is only one method.</summary>
			if (this.previous.length === 0)
				return null;

			//Take the top of the last subtree, and add
			//all of its subtrees to our other subtrees

			var newTop = this.previous[this.previous.length - 1];

			var newPrevious = this.previous.concat(newTop.previous);
			newPrevious.splice(this.previous.length - 1, 1);
			return newTop.copy(newPrevious);
		},

		remove: function () {
			/// <summary>Removes the last (most recently added) occurrence of each method in one or more delegates from this delegate, returning a new delegate (or null if there are no other methods).</summary>
			return removeImpl(this, flatten(arguments), false);
		},
		removeAll: function () {
			/// <summary>Removes all of the methods in one or more delegates from this delegate, returning a new delegate (or null if there are no other methods).</summary>
			return removeImpl(this, flatten(arguments), true);
		}
	};
	function flatten(arr) {
		var retVal = [];
		for (var i = 0; i < arr.length; i++) {
			if (isDelegate(arr[i]))
				arr[i].each(function (d) { retVal.push(d); });
			else
				retVal.push(arr[i]);
		}
		return retVal;
	}
	function removeImpl(source, toRemove, removeAll) {
		if (!(toRemove instanceof Array))
			throw new Error("toRemove must be flattened");

		for (var i = 0; i < toRemove.length; i++) {
			if (!isMatch(source, toRemove[i]))
				continue;
			if (source.previous.length === 0)
				return null;
			else {
				if (!removeAll)	//If we're only removing the first occurrence, remove that match from the array of removables
					toRemove.splice(i, 1);

				//If the delegate at the top of the tree matches,
				//remove it and start again (in case the next one
				//also needs to be removed).
				return removeImpl(source.pop(), toRemove, removeAll);
			}
		}

		var retVal = source;
		//If the top of the tree doesn't match,
		//loop backward through the rest of the
		//tree and remove any matches.
		for (i = retVal.previous.length - 1; i >= 0; i--) {
			//toRemove is modified in-place
			var trimmed = removeImpl(retVal.previous[i], toRemove, removeAll);
			if (trimmed === retVal.previous[i])
				continue; //If this subtree doesn't need to change, skip it

			//If this is the first change, copy the array before we start modifying it
			if (retVal === source)
				retVal = source.copy(source.previous.slice());

			if (trimmed !== null)
				retVal.previous[i] = trimmed;
			else		//If the entire subtree was removed, remove the entry from the array.
				retVal.previous.splice(i, 1);
		}
		return retVal;
	}
	function isMatch(delegate, comparand) {
		if (isDelegate(comparand))
			return (delegate.method === comparand.method && delegate.target === comparand.target);
		if (typeof comparand === "function")
			return delegate.method === comparand;
		if (typeof comparand === "string")
			return comparand === delegate.method.name;

		throw new Error("Unsupported remove() parameter: " + comparand);
	}

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