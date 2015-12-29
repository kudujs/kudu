define(function (require) {

	require("../../utils/jqr/npo");

	function unrender(options) {

		var promise = new Promise(function (resolve, reject) {

			options.mvc.view.transitionsEnabled = false;
			//options.view.transitionsEnabled = false;

			options.mvc.view.unrender().then(function () {

				resolve(options.view);

			}).catch(function (error) {
				reject.apply(undefined, [error, options.view]);
			});
		});

		return promise;
	}
	return unrender;
});