define(function (require) {

	var $ = require("jquery");

	function render(options) {

		var deferred = $.Deferred();
		var promise = deferred.promise();

		options.view.transitionsEnabled = false;

		options.view.render(options.target).then(function () {

			options.view.transitionsEnabled = true;
			
			deferred.resolve(options.view);

		}, function (error) {
			deferred.reject(error, options.view);
		});

		return promise;
	}
	return render;
});