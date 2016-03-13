define(function (require) {

	require("../utils/jqr/npo");
	var utils = require( "../utils/utils" );
	var severity = require( "../utils/severity" );

	function onInitHandler(options) {

		var promise = new Promise(function (resolve, reject) {

			if (typeof options.ctrl.onInit !== 'function') {
				var err = new Error( "Controllers *must* implement an onInit method that returns either a Ractive function or a promise that resolves to a Ractive function!" );
				utils.populateError( err, severity.WARN, options );
				reject( err );
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