define(function (require) {

	var $ = require("jquery");
	var fade = require("./fade");

	function intro(options) {

		var deferred = $.Deferred();
		var promise = deferred.promise();
		
		if (options.fx !== true) {
			deferred.resolve();
			return promise;
		}
		
		var transition = options.intro || fade.intro;

		transition(options, deferred.resolve);

		return promise;
	}
	return intro;
});