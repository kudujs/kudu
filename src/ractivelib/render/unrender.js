define(function (require) {

	require("../../utils/jqr/npo");
	var utils = require("../../utils/utils");
	var severity = require("../../utils/severity");

	function unrender(options) {

		var promise = new Promise(function (resolve, reject) {
			
			// If users navigates quickly around the screen without waiting for transitions to complete,
			// we could run into situation where the unrender/render calls starts stepping on each other toes.
			// When this happens we switch off animations to force the rendering into a synchronous chain.
			// However Ractive doesn't provide a way yet to abort current transitions, so Ractive.unrender might
			// not resolve, and Kudu wouldn't know the previous view request was overwritten by a new view request.
			// Here we use a workaround to force resolve the unrender promise, if Kudu  detects views overwriting each
			// other. When Ractive supports aborting the current transition, we can remove this workaround and rather
			// abort the current transition
			options.forceUnrender = function() {
				resolve(options.view);
			};

			options.mvc.view.unrender().then(function () {

				resolve(options.view);

			}).catch(function (err) {
				utils.populateError( err, severity.ERROR, options );
				reject( err );
			});
		});

		return promise;
	}
	return unrender;
});