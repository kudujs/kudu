define(function (require) {

	var simpleAjaxTracker = {};

	simpleAjaxTracker.create = function (ajaxTracker, options) {
		var adaptor = {
			add: function (jqXhr, args) {
				ajaxTracker.add(options.target, jqXhr, args);
			},
			remove: function (jqXhr) {
				ajaxTracker.remove(options.target, jqXhr);
			},
			abort: function () {
				ajaxTracker.abort(options.target);
			}
		};

		return adaptor;
	};

	return simpleAjaxTracker;
});
