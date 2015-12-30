/* modules: 
 * https://www.npmjs.com/package/nodejs-config
 */

var program = require('./cli');
var nodeJsConfig = require('nodejs-config');
var fs = require('fs-extra');

var config = nodeJsConfig(
		process.cwd(), // an absolute path to your applications 'config' directory

		function () {
			//return process.env.NODE_ENV;
			if (program.dev) {
				return "dev";
			} else {
				return "prod";
			}
		}
);

var appConfig = config.get("app");
// Read in package.json
var packageJson = fs.readFileSync("../package.json", 'utf8');
packageJson = JSON.parse(packageJson);

appConfig.version = packageJson.version;

module.exports = config;