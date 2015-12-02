define(function (require) {

	var $ = require("jquery");

	function unrender(options) {

		var deferred = $.Deferred();
		var promise = deferred.promise();
		
		options.mvc.view.transitionsEnabled = false;
		//options.view.transitionsEnabled = false;

		options.mvc.view.unrender().then(function () {
		//options.view.unrender(options.target).then(function () {
			
			deferred.resolve(options.view);

		}, function (error) {
			deferred.reject(error, options.view);
		});

		return promise;
	}
	return unrender;
});