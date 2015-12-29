define(function (require) {

	require("../utils/jqr/npo");
	var fade = require("./fade");

	function intro(options) {

		var promise = new Promise(function (resolve, reject) {

			if (options.fx !== true) {
				resolve();
				return promise;
			}

			var transition = options.intro || fade.intro;

			transition(options, resolve);
		});

		return promise;
	}
	return intro;
});