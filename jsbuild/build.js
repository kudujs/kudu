/* modules: 
 * https://www.npmjs.com/package/fs-extra
 * https://www.npmjs.com/package/glob
 * https://www.npmjs.com/package/node-version-assets
 */

var cli = require('./mods/cli');
var config = require('./mods/config');
var optimize = require('./mods/optimize');
var fs = require('fs-extra');
var path = require('path');
var glob = require('glob');

// Read in the build config file
var rConfig = fs.readFileSync("./config/r.build.js", 'utf8');
rConfig = eval(rConfig);

var appConfig = config.get("app");

// Remove the deploy folder in case of previous builds
clean(appConfig);

optimize(rConfig, appConfig).then(function (buildResponse) {
	console.log("Build completed successfully!");
	deployToTemplate(appConfig);
});

function clean(config) {
	fs.removeSync(config.dist);
	console.log("Removed previous buildpath: " + config.dist);
}

function deployToTemplate(appConfig) {
	//fs.removeSync(config.dist);
	glob(appConfig.dist + '/*min*', function(er, files) {
		copyFileArray(files, appConfig.template, {clobber: true});
	});
	console.log("Copied dist:'" + appConfig.dist + "' to template: '" + appConfig.template + "'");
}

function copyFileArray(files, destFolder, options) {
	if (files == null) {
		console.log("no files to copy");
		return;
	}
	if (!Array.isArray(files)) {
		console.log("files is not an array!");
		return;
	}

	for (var i = 0; i < files.length; i++) {
		var filename = path.basename(files[i]);
		var dest = destFolder + "/" + filename;
		fs.copySync(files[i], dest, options);
	}
}


console.log("Running build in", config.environment(), "mode");