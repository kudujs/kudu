define(function (require) {

	var $ = require("jquery");
	var utils = require("./utils");

	function ajaxTracker(kudu) {

		if (kudu == null) {
			throw new Error("ajaxTracker requires a kudu instance!");
		}

		var that = {};
		var idCounter = 0;
		var promiseCounter = 0;

		var promisesMap = {};
		var globalPromise = null;
		//var globalPromiseArgs = {};

		that.add = function (target, promise, args) {
			
			if (typeof promise.abort !== 'function') {
				throw new Error("ajaxTracker.add(promise) requires an 'abort' function for when views are cancelled!");
			}

			var promisesArray = promisesMap[target];
			if (promisesArray == null) {
				promisesArray = [];
				promisesMap[target] = promisesArray;
			}

			var item = {promise: promise, args: args};
			promisesArray.push(item);

			var triggerOptions = {
				jqXHR: promise,
				args: args
			};
			if (globalPromise == null) {
				globalPromise = $.when(promise);
				/*
				 if (args != null) {
				 globalPromiseArgs = $.extend({}, args);
				 }*/

				$(kudu).trigger("global.ajax.start", [triggerOptions]);
				triggerOptions.args = args;
				$(kudu).trigger("ajax.start", [triggerOptions]);

			} else {
				globalPromise = $.when(globalPromise, promise);
				/*
				 if (args != null) {
				 globalPromiseArgs = $.extend(globalPromiseArgs, args);
				 }*/
				triggerOptions.args = args;
				$(kudu).trigger("ajax.start", [triggerOptions]);
			}
			globalPromise._id = idCounter++;

			addListeners(target, globalPromise, promise, args);
			//console.log("DONE registering", globalPromise._id);

			promiseCounter++;

			return globalPromise;
		};

		that.remove = function (target, promise) {
			var jqpromiseArray = promisesMap[target];
			if (jqpromiseArray == null) {
				return false;
			}

			var index = -1;
			for (var i = 0; i < jqpromiseArray.length; i++) {
				var item = jqpromiseArray[i];
				if (item.promise === promise) {
					index = i;
					break;
				}
			}

			if (index >= 0) {
				jqpromiseArray.splice(index, 1);
				if (jqpromiseArray.length === 0) {
					delete promisesMap[target];
				}
				promiseCounter--;
				return true;
			}
			return false;
		};

		that.clear = function (target) {
			if (arguments.length === 0) {
				promisesMap = {};

			} else {
				delete promisesMap[target];
			}
		};

		that.abort = function (target) {
			if (arguments.length === 0) {
				for (var key in promisesMap) {
					if (promisesMap.hasOwnProperty(key)) {
						var promisesArray = promisesMap[key];
						abortItems(promisesArray);

					}
				}


				abortItems(promisesArray);

				return;
			}

			var promisesArray = promisesMap[target];
			if (promisesArray == null) {
				return;
			}

			abortItems(promisesArray);
		};

		function abortItems(promisesArray) {
			// promiseArray could be manipulated outside the loop below, so we make a copy
			var promisesCopy = promisesArray.slice();
			$.each(promisesCopy, function (index, item) {
				item.promise.abort();
			});
			globalPromise = null;
			//globalPromiseArgs = {};			
		}

		function addListeners(target, globalPromiseParam, promiseParam, args) {

			promiseParam.then(function (data, status, jqXHR) {

				var triggerOptions;

				if (isXhr(jqXHR)) {
					triggerOptions = {data: data, status: status, jqXHR: jqXHR, args: args};

				} else {
					var promiseArgs;
					if (arguments.length > 0) {
						promiseArgs = Array.prototype.slice.call(arguments);
					}
					triggerOptions = {data: null, status: null, jqXHR: null, error: null, args: args, promiseArgs: promiseArgs};
				}

				$(kudu).trigger("ajax.success", [triggerOptions]);

			}, function (jqXHR, status, error) {

				var triggerOptions;

				if (isXhr(jqXHR)) {
					var triggerOptions = {error: error, status: status, jqXHR: jqXHR, args: args};

				} else {
					var promiseArgs;
					if (arguments.length > 0) {
						promiseArgs = Array.prototype.slice.call(arguments);
					}
					triggerOptions = {data: null, status: null, jqXHR: null, error: null, args: args, promiseArgs: promiseArgs};
				}

				$(kudu).trigger("ajax.error", [triggerOptions]);
			});

			promiseParam.always(function (dataOrjqXHR, status, errorOrjqXHR) {
				// Note: the promise might not be an ajax request at all!

				var triggerOptions;

				if (isXhr(dataOrjqXHR)) {
					triggerOptions = {data: dataOrjqXHR, status: status, jqXHR: errorOrjqXHR, error: null, args: args};

				} else if (isXhr(errorOrjqXHR)) {
					triggerOptions = {data: null, status: status, jqXHR: dataOrjqXHR, error: errorOrjqXHR, args: args};

				} else {
					var promiseArgs;
					if (arguments.length > 0) {
						promiseArgs = Array.prototype.slice.call(arguments);
					}
					triggerOptions = {data: null, status: null, jqXHR: null, error: null, args: args, promiseArgs: promiseArgs};
				}

				$(kudu).trigger("ajax.complete", [triggerOptions]);
				var removed = that.remove(target, promiseParam);
				//console.log("Removed?", removed);
			});

			globalPromiseParam.then(function (data, status, jqXHR) {

				var triggerOptions;

				if (isXhr(jqXHR)) {
					triggerOptions = {data: data, status: status, jqXHR: jqXHR, args: args};

				} else {
					var promiseArgs;
					if (arguments.length > 0) {
						promiseArgs = Array.prototype.slice.call(arguments);
					}
					triggerOptions = {data: null, status: null, jqXHR: null, error: null, args: args, promiseArgs: promiseArgs};
				}

				// Only process if this is the globalPromise, otherwise globalPromise has been overwritten
				if (globalPromise == null || globalPromise == globalPromiseParam) {

					$(kudu).trigger("ajax.stop", [triggerOptions]);

					delete triggerOptions.args;
					$(kudu).trigger("global.ajax.stop", [triggerOptions]);
					globalPromise = null;
					//globalPromiseArgs = {};
				} else {
					//console.log("globalPromise ignore then");
					$(kudu).trigger("ajax.stop", [triggerOptions]);
				}

			}, function (jqXHR, status, error) {

				var triggerOptions;

				if (isXhr(jqXHR)) {
					triggerOptions = {error: error, status: status, jqXHR: jqXHR, args: args};

				} else {
					var promiseArgs;
					if (arguments.length > 0) {
						promiseArgs = Array.prototype.slice.call(arguments);
					}

					triggerOptions = {data: null, status: null, jqXHR: null, error: null, args: args, promiseArgs: promiseArgs};
				}

				if (globalPromise == null || globalPromise == globalPromiseParam) {

					$(kudu).trigger("ajax.stop", [triggerOptions]);

					delete triggerOptions.args;
					$(kudu).trigger("global.ajax.stop", [triggerOptions]);
					globalPromise = null;
					//globalPromiseArgs = {};
					//console.log("globalPromise ERROR", globalPromiseParam);
					//console.log(arguments);

				} else {
					//console.log("globalPromise ignore error");
					$(kudu).trigger("ajax.stop", [triggerOptions]);
					return;
				}
			});

			globalPromiseParam.always(function () {

				if (globalPromise == null || globalPromise == globalPromiseParam) {
					//console.log("globalPromise ALWAYS", arguments);
					//console.log("Promises size1:", utils.objectLength(jqXHRMap));
					//console.log("Promises size2:", promiseCounter);

				} else {
					//console.log("globalPromise ignore always");
					return;
				}
			});
		}

		function isXhr(xhr) {
			if (xhr != null) {
				if (typeof xhr.getAllResponseHeaders === 'function' && typeof xhr.abort === 'function') {
					// assume dataOrjqXHR is a jqXHR and thus an Ajax request
					return true;
				}
			}

			return false;
		}

		return that;
	}

	return ajaxTracker;
});