define(function (require) {

	var $ = require("jquery");

	function onInitHandler(options) {
		
		var deferred = $.Deferred();
		var promise = deferred.promise();

		if (typeof options.ctrl.onInit !== 'function') {
			deferred.reject("Controllers *must* implement an onInit method that returns either a Ractive function or a promise that resolves to a Ractive function!");
			return promise;
		}

		var viewOptions = {
			routeParams: options.routeParams,
			args: options.args,
			ajaxTracker: options.ajaxTracker
		};

		var ractiveFnOrPromise = options.ctrl.onInit(viewOptions);
		
		deferred.resolve(ractiveFnOrPromise);
		
		/*
		if (options.createView) {
			promise = options.createView(options);
		} else {
			promise = createView(options);
		}*/

		return promise;
	}

	return onInitHandler;
});