define(function (require) {

	require("../../utils/jqr/npo");

	function render(options) {

		var promise = new Promise(function (resolve, reject) {

			//options.view.transitionsEnabled = false;

			var completePromise = options.view.render(options.target);
			//resolve(options.view);

			completePromise.then(function () {

				//options.view.transitionsEnabled = true;

				resolve(options.view);

			}).catch(function (error) {
				reject.apply(undefined, [error, options.view]);
			});
		});

		return promise;
	}
	return render;
});