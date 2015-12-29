define(function (require) {

	var utils = require("../utils/utils");
	require("../utils/jqr/npo");

	function onRemoveHandler(options) {

		var promise = new Promise(function (resolve, reject) {

			if (typeof options.ctrl.onRemove !== 'function') {
				resolve();
				return promise;
			}

			var viewOptions = {
				ctrl: options.ctrl,
				route: options.route,
				routeParams: options.routeParams,
				args: options.args,
				view: options.view,
				ajaxTracker: options.ajaxTracker,
				next: options.next
			};

			var booleanOrPromise = options.ctrl.onRemove(viewOptions);

			if (booleanOrPromise == null || booleanOrPromise == true) {
				resolve();
				return promise;
			}

			if (booleanOrPromise == false) {
				reject("controller onRemove() returned false");
				return promise;
			}

			if (utils.isPromise(booleanOrPromise)) {
				booleanOrPromise.then(function (bool) {

					// Request could have been overwritten by new request. Ensure this is still the active request
					if (!options.mvc.requestTracker.active) {
						reject("Request overwritten by another view request");
						return promise;
					}

					if (bool == null || bool == true) {
						resolve();
					} else {
						reject();
					}
				}).catch(function () {
					// onRemove promise rejected
					reject();

				});

			} else {
				console.warn("Ignoring new view since onRemove did not return a valid response. onRemove must return either true/false or a promise that resolves to true/false.");
				reject();
			}
		});
		return promise;
	}

	return onRemoveHandler;
});