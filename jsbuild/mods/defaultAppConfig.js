/* modules: 
 * https://www.npmjs.com/package/nodejs-config
 * 
 * Note: This module is the same as "./config" except it loads the default configuration,
 * and not a specific environment config. This is mostly useful to look up the "version"
 * of of the app from the config since the version might be needed *before* we know
 * which environment we are running in.
 */

var nodeJsConfig = require('nodejs-config');

function loadConfig() {

	var config = nodeJsConfig(
			process.cwd() // an absolute path to your applications 'config' directory
	);
	return config;
}

var config = loadConfig();
module.exports = config.get("app");