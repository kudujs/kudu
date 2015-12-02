define(function (require) {

	var $ = require("jquery");
	var fade = require("./fade");

	function outro(options) {

		var deferred = $.Deferred();
		var promise = deferred.promise();
		
		if (options.fx !== true) {
			deferred.resolve();
			return promise;
		}
		
		var transition = options.outro || fade.outro;

		transition(options, deferred.resolve);

		return promise;
	}
	return outro;
});