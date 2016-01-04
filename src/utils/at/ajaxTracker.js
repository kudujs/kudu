define(function (require) {

	require("../jqr/npo");
	var jqxhrWrapper = require("./jqxhrWrapper");
	var xhrWrapper = require("./xhrWrapper");
	var jqutils = require("../jqr/jqutils");

	function ajaxTracker(options) {

		if (options.kudu == null) {
			throw new Error("ajaxTracker requires an options.kudu instance!");
		}

		var that = {};
		var idCounter = 0;
		var promiseCounter = 0;

		var promisesMap = {};
		var globalPromise = null;
		//var globalPromiseArgs = {};

		var wrappers = {
			xhr: xhrWrapper,
			jqxhr: jqxhrWrapper
		};

		wrappers = jqutils.extend(wrappers, options.wrappers);

		that.add = function (target, promiseOrXhr, args) {

			if (typeof promiseOrXhr.abort !== 'function') {
				throw new Error("ajaxTracker.add(promiseOrXhr) requires an 'abort' function for when views are cancelled!");
			}
			
			var promiseXhr;

			if (promiseOrXhr.then == null || promiseOrXhr.catch == null) {
				promiseXhr = that.promisify(promiseOrXhr);
			} else {
				promiseXhr = promiseOrXhr;
			}
		
			var promisesArray = promisesMap[target];
			if (promisesArray == null) {
				promisesArray = [];
				promisesMap[target] = promisesArray;
			}

			var item = {promise: promiseXhr, args: args};
			promisesArray.push(item);

			var triggerOptions = {
				xhr: promiseXhr,
				args: args
			};
			if (globalPromise == null) {
				globalPromise = Promise.all([promiseXhr]);

				options.kudu.emit("global.ajax.start", triggerOptions);
				triggerOptions.args = args;
				options.kudu.emit("ajax.start", triggerOptions);

			} else {
				globalPromise = Promise.all([globalPromise, promiseXhr]);
				/*
				 if (args != null) {
				 globalPromiseArgs = jqutils.extend(globalPromiseArgs, args);
				 }*/
				triggerOptions.args = args;
				options.kudu.emit("ajax.start", triggerOptions);
			}
			globalPromise._id = idCounter++;

			addListeners(target, globalPromise, promiseXhr, args);
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

		that.promisify = function (obj) {
			for (var key in wrappers) {
				if (wrappers.hasOwnProperty(key)) {
					var wrapper = wrappers[key];
					if (wrapper.canWrap(obj)) {
						var result = wrapper.wrap(obj);
						return result;
					}
				}
			}
			return obj;
		};

		function abortItems(promisesArray) {
			// promiseArray could be manipulated outside the loop below, so we make a copy
			var promisesCopy = promisesArray.slice();
			promisesCopy.forEach(function (item, index) {
				item.promise.abort();
			});
			globalPromise = null;
			//globalPromiseArgs = {};			
		}

		function addListeners(target, globalPromiseParam, promiseParam, args) {

			promiseParam.then(function (value) {

				var triggerOptions;

				if (xhrWrapper.isXhr(value.xhr)) {
					triggerOptions = {data: value.data, status: value.status, xhr: value.xhr, args: args};

				} else {
					// Not sure about the use case of Promises with AjaxTracker
					var promiseArgs;
					if (arguments.length > 0) {
						promiseArgs = Array.prototype.slice.call(arguments);
					}
					triggerOptions = {data: null, status: null, xhr: null, error: null, args: args, promiseArgs: promiseArgs};
				}

				options.kudu.emit("ajax.success", triggerOptions);

			}).catch(function (reason) {

				var triggerOptions;

				if (xhrWrapper.isXhr(reason.xhr)) {
					triggerOptions = {error: reason.error, status: reason.status, xhr: reason.xhr, args: args};

				} else {
					// Not sure about the use case of Promises with AjaxTracker
					var promiseArgs;
					if (arguments.length > 0) {
						promiseArgs = Array.prototype.slice.call(arguments);
					}
					triggerOptions = {data: null, status: null, xhr: null, error: null, args: args, promiseArgs: promiseArgs};
				}

				options.kudu.emit("ajax.error", triggerOptions);
			});

			promiseParam.then(function (value) {
				always(value, true);
			}).catch(function (reason) {
				always(reason, false);
			});

			function always(value, success) {
				// Note: the promise might not be an ajax request at all!

				var triggerOptions;

				if (!xhrWrapper.isXhr(value.xhr)) {
					// Not sure about the use case of Promises with AjaxTracker
					var promiseArgs;
					if (arguments.length > 0) {
						promiseArgs = Array.prototype.slice.call(arguments);
					}
					triggerOptions = {data: null, status: null, xhr: null, error: null, args: args, promiseArgs: promiseArgs};

				} else {

					if (success === true) {
						triggerOptions = {data: value.data, status: value.status, xhr: value.xhr, error: null, args: args};

					} else {
						triggerOptions = {data: null, status: value.status, xhr: value.xhr, error: value.error, args: args};
					}
				}


				options.kudu.emit("ajax.complete", triggerOptions);
				var removed = that.remove(target, promiseParam);
				//console.log("Removed?", removed);
			}

			globalPromiseParam.then(function (value) {

				var triggerOptions;

				if (xhrWrapper.isXhr(value.xhr)) {
					triggerOptions = {data: value.data, status: value.status, xhr: value.xhr, args: args};

				} else {
					// Not sure about the use case of Promises with AjaxTracker
					var promiseArgs;
					if (arguments.length > 0) {
						promiseArgs = Array.prototype.slice.call(arguments);
					}
					triggerOptions = {data: null, status: null, xhr: null, error: null, args: args, promiseArgs: promiseArgs};
				}

				// Only process if this is the globalPromise, otherwise globalPromise has been overwritten
				if (globalPromise == null || globalPromise == globalPromiseParam) {

					options.kudu.emit("ajax.stop", triggerOptions);

					delete triggerOptions.args;
					options.kudu.emit("global.ajax.stop", triggerOptions);
					globalPromise = null;
					//globalPromiseArgs = {};
				} else {
					//console.log("globalPromise ignore then");
					options.kudu.emit("ajax.stop", triggerOptions);
				}

			}).catch(function (reason) {

				var triggerOptions;

				if (xhrWrapper.isXhr(reason.xhr)) {
					triggerOptions = {error: reason.error, status: reason.status, xhr: reason.xhr, args: args};

				} else {
					// Not sure about the use case of Promises with AjaxTracker
					var promiseArgs;
					if (arguments.length > 0) {
						promiseArgs = Array.prototype.slice.call(arguments);
					}

					triggerOptions = {data: null, status: null, xhr: null, error: null, args: args, promiseArgs: promiseArgs};
				}

				if (globalPromise == null || globalPromise == globalPromiseParam) {

					options.kudu.emit("ajax.stop", triggerOptions);

					delete triggerOptions.args;
					options.kudu.emit("global.ajax.stop", triggerOptions);
					globalPromise = null;
					//globalPromiseArgs = {};
					//console.log("globalPromise ERROR", globalPromiseParam);
					//console.log(arguments);

				} else {
					//console.log("globalPromise ignore error");
					options.kudu.emit("ajax.stop", triggerOptions);
					return;
				}
			});
			/*
			 globalPromiseParam.always(function () {
			 
			 if (globalPromise == null || globalPromise == globalPromiseParam) {
			 //console.log("globalPromise ALWAYS", arguments);
			 //console.log("Promises size1:", utils.objectLength(jqXHRMap));
			 //console.log("Promises size2:", promiseCounter);
			 
			 } else {
			 //console.log("globalPromise ignore always");
			 return;
			 }
			 });*/
		}
	
		return that;
	}

	return ajaxTracker;
});
