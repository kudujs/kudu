define(function (require) {

	var $ = require("jquery");
	var utils = require("../../utils/utils");
	var severity = require("../../utils/severity");

	function create(options) {

		var deferred = $.Deferred();
		var promise = deferred.promise();

		if (options.viewOrPromise == null) {
			console.warn("Ignoring view since onInit returned null. onInit must return either a Ractive function or a promise that resolves to a Ractive function.");
			// TODO how to handle errors in kudu generically?
			deferred.reject({level: severity.INFO, message: "Ignoring view since onInit returned null. onInit must return either a Ractive function or a promise that resolves to a Ractive function."});
			return promise;
		}

		if (utils.isPromise(options.viewOrPromise)) {

			options.viewOrPromise.then(function (ractiveObj) {

				if (typeof ractiveObj === 'function') {
					ractiveObj = new ractiveObj();
				}

				// Request could have been overwritten by new request. Ensure this is still the active request
				if (!options.mvc.requestTracker.active) {
					deferred.reject("Request overwritten by another view request");
					return promise;
				}

				var view = ractiveObj;
				deferred.resolve(view);

			}, function () {
				if (!options.mvc.requestTracker.active && arguments.length === 0) {
					deferred.reject("Request overwritten by another view request");
				} else {
					// if the Ctrl.onInit() call rejected promise
					deferred.reject.apply(deferred, arguments);
					
				}

			});

		} else if ($.isFunction(options.viewOrPromise)) {
			// Assume it is a Ractive function
			// Should this scenrio be supported? How will the view receive an instance to the ractive
			//options.kudu.createRactive(RactiveFnOrPromise);
			var view = new options.viewOrPromise();
			deferred.resolve(view);

		} else if (utils.isRactiveObject(options.viewOrPromise)) {
			// Assume it is a Ractive instance
			var view = options.viewOrPromise;
			deferred.resolve(view);

		} else {
			console.warn("Ignoring view since onInit did not return a valid response. onInit must return either a Ractive function or a promise that resolves to a Ractive function.");
			deferred.reject("Ignoring view since onInit did not return a valid response. onInit must return either a Ractive function or a promise that resolves to a Ractive function.");
		}

		return promise;
	}

	return create;
});