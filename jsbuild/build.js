/* modules: 
 * https://www.npmjs.com/package/fs-extra
 * https://www.npmjs.com/package/glob
 * https://www.npmjs.com/package/node-version-assets
 */

var cli = require('./mods/cli');
var config = require('./mods/config');
var optimize = require('./mods/optimize');
var fs = require('fs-extra');

// Read in the build config file
var rConfig = fs.readFileSync("./config/r.build.js", 'utf8');
rConfig = eval(rConfig);

var appConfig = config.get("app");

// Remove the deploy folder in case of previous builds
clean(appConfig);

optimize(rConfig, appConfig).then(function (buildResponse) {
	console.log("Build completed successfully!");
});

function clean(config) {
	fs.removeSync(config.dist);
	console.log("Removed previous buildpath: " + config.dist);
}

console.log("Running build in", config.environment(), "mode");