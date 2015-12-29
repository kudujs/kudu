define(function (require) {

	require("./jqr/npo");

	function toES6Promise($promise) {
		var es6Promise = new Promise(function (resolve, reject) {

			$promise.then(function (data, textStatus, jqXHR) {
				resolve({data: data, status: textStatus, xhr: jqXHR});
			}, function (jqXHR, textStatus, errorThrown) {
				reject({error: errorThrown, status: textStatus, xhr: jqXHR});
			});

			$promise.then(resolve, reject);
		});
		es6Promise.abort = $promise.abort;
		return es6Promise;
	}

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

			if (isXhr(promise) && typeof promise.then === 'function') {
				// assume it is a jquery xhr, convert to es6 promise
				promise = toES6Promise(promise);
			}

			var promisesArray = promisesMap[target];
			if (promisesArray == null) {
				promisesArray = [];
				promisesMap[target] = promisesArray;
			}

			var item = {promise: promise, args: args};
			promisesArray.push(item);

			var triggerOptions = {
				xhr: promise,
				args: args
			};
			if (globalPromise == null) {
				globalPromise = Promise.all([promise]);

				kudu.emit("global.ajax.start", triggerOptions);
				triggerOptions.args = args;
				kudu.emit("ajax.start", triggerOptions);

			} else {
				globalPromise = Promise.all([globalPromise, promise]);
				/*
				 if (args != null) {
				 globalPromiseArgs = jqutils.extend(globalPromiseArgs, args);
				 }*/
				triggerOptions.args = args;
				kudu.emit("ajax.start", triggerOptions);
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
			promisesCopy.forEach(function (item, index) {
				item.promise.abort();
			});
			globalPromise = null;
			//globalPromiseArgs = {};			
		}

		function addListeners(target, globalPromiseParam, promiseParam, args) {

			promiseParam.then(function (value) {

				var triggerOptions;

				if (isXhr(value.xhr)) {
					triggerOptions = {data: value.data, status: value.status, xhr: value.xhr, args: args};

				} else {
					var promiseArgs;
					if (arguments.length > 0) {
						promiseArgs = Array.prototype.slice.call(arguments);
					}
					triggerOptions = {data: null, status: null, xhr: null, error: null, args: args, promiseArgs: promiseArgs};
				}

				kudu.emit("ajax.success", triggerOptions);

			}).catch(function (reason) {

				var triggerOptions;

				if (isXhr(reason.xhr)) {
					triggerOptions = {error: reason.error, status: reason.status, xhr: reason.xhr, args: args};

				} else {
					var promiseArgs;
					if (arguments.length > 0) {
						promiseArgs = Array.prototype.slice.call(arguments);
					}
					triggerOptions = {data: null, status: null, xhr: null, error: null, args: args, promiseArgs: promiseArgs};
				}

				kudu.emit("ajax.error", triggerOptions);
			});
			
			promiseParam.then(function (value) {
				always(value, true);
			}).catch(function (reason) {
				always(reason, false);
			});

			function always(value, success) {
				// Note: the promise might not be an ajax request at all!

				var triggerOptions;

				if (isXhr(value.xhr)) {
					// not an ajax request, just normal promise
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


				kudu.emit("ajax.complete", triggerOptions);
				var removed = that.remove(target, promiseParam);
				//console.log("Removed?", removed);
			}

			globalPromiseParam.then(function (value) {

				var triggerOptions;

				if (isXhr(value.xhr)) {
					triggerOptions = {data: value.data, status: value.status, xhr: value.xhr, args: args};

				} else {
					var promiseArgs;
					if (arguments.length > 0) {
						promiseArgs = Array.prototype.slice.call(arguments);
					}
					triggerOptions = {data: null, status: null, xhr: null, error: null, args: args, promiseArgs: promiseArgs};
				}

				// Only process if this is the globalPromise, otherwise globalPromise has been overwritten
				if (globalPromise == null || globalPromise == globalPromiseParam) {

					kudu.emit("ajax.stop", triggerOptions);

					delete triggerOptions.args;
					kudu.emit("global.ajax.stop", triggerOptions);
					globalPromise = null;
					//globalPromiseArgs = {};
				} else {
					//console.log("globalPromise ignore then");
					kudu.emit("ajax.stop", triggerOptions);
				}

			}).catch(function (reason) {

				var triggerOptions;

				if (isXhr(reason.xhr)) {
					triggerOptions = {error: reason.error, status: reason.status, xhr: reason.xhr, args: args};

				} else {
					var promiseArgs;
					if (arguments.length > 0) {
						promiseArgs = Array.prototype.slice.call(arguments);
					}

					triggerOptions = {data: null, status: null, xhr: null, error: null, args: args, promiseArgs: promiseArgs};
				}

				if (globalPromise == null || globalPromise == globalPromiseParam) {

					kudu.emit("ajax.stop", triggerOptions);

					delete triggerOptions.args;
					kudu.emit("global.ajax.stop", triggerOptions);
					globalPromise = null;
					//globalPromiseArgs = {};
					//console.log("globalPromise ERROR", globalPromiseParam);
					//console.log(arguments);

				} else {
					//console.log("globalPromise ignore error");
					kudu.emit("ajax.stop", triggerOptions);
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
