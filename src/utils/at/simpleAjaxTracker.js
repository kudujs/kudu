define(function (require) {

	var simpleAjaxTracker = {};

	simpleAjaxTracker.create = function (ajaxTracker, options) {
		var adaptor = {
			add: function (xhrOrPromise, args) {
				ajaxTracker.add(options.target, xhrOrPromise, args);
			},
			remove: function (xhrOrPromise) {
				ajaxTracker.remove(options.target, xhrOrPromise);
			},
			abort: function () {
				ajaxTracker.abort(options.target);
			}
		};

		return adaptor;
	};

	return simpleAjaxTracker;
});
