define(function (require) {

	require("../../utils/jqr/npo");
	var utils = require("../../utils/utils");
	var severity = require("../../utils/severity");

	function render(options) {

		var promise = new Promise(function (resolve, reject) {

			//options.view.transitionsEnabled = false;

			var completePromise = options.view.render(options.target);
			//resolve(options.view);

			completePromise.then(function () {

				//options.view.transitionsEnabled = true;

				resolve(options.view);

			}).catch(function (err) {
				utils.populateError( err, severity.ERROR, options );
				reject( err );
			});
		});

		return promise;
	}
	return render;
});