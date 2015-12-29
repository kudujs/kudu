define(function (require) {

	require("../utils/jqr/npo");
	var fade = require("./fade");

	function outro(options) {

		var promise = new Promise(function (resolve, reject) {

			if (options.fx !== true) {
				resolve();
				return promise;
			}

			var transition = options.outro || fade.outro;

			transition(options, resolve);
		});

		return promise;
	}
	return outro;
});