/* modules: 
 * https://www.npmjs.com/package/requirejs
 */

var requirejs = require('requirejs');

var promise = new Promise(function (resolve, reject) {

	module.exports = function (rConfig, appConfig) {
		
		// Set the r.js build version to our app version
		rConfig.version = appConfig.version;
		var tmpOut = rConfig.out;
		var tmpGenerateSourceMaps = rConfig.generateSourceMaps;

		rConfig.optimize = "none";
		rConfig.generateSourceMaps = false;
		rConfig.out = rConfig.srcOut;
		rConfig.out = rConfig.out.replace("{version}", appConfig.version);

		requirejs.optimize(rConfig, function (srcBuildResponse) {

			rConfig.out = tmpOut;
			rConfig.out = rConfig.out.replace("{version}", appConfig.version);
			rConfig.generateSourceMaps = tmpGenerateSourceMaps;
			rConfig.optimize = "uglify2";

			requirejs.optimize(rConfig, function (minBuildResponse) {

				resolve(srcBuildResponse, minBuildResponse);

			}, function (err) {
				console.log(err);
				reject(err);
				//optimization err callback
			});
			}, function (err) {
			console.log(err);
			reject(err);
			//optimization err callback
		});

		return promise;
	};
});