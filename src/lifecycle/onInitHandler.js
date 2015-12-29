define(function (require) {

	require("../utils/jqr/npo");

	function onInitHandler(options) {

		var promise = new Promise(function (resolve, reject) {

			if (typeof options.ctrl.onInit !== 'function') {
				reject("Controllers *must* implement an onInit method that returns either a Ractive function or a promise that resolves to a Ractive function!");
				return promise;
			}

			var viewOptions = {
				ctrl: options.ctrl,
				route: options.route,
				routeParams: options.routeParams,
				args: options.args,
				ajaxTracker: options.ajaxTracker,
				prev: options.prev
			};

			var ractiveFnOrPromise = options.ctrl.onInit(viewOptions);

			resolve(ractiveFnOrPromise);

			/*
			 if (options.createView) {
			 promise = options.createView(options);
			 } else {
			 promise = createView(options);
			 }*/
		});

		return promise;
	}

	return onInitHandler;
});