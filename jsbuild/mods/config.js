/* modules: 
 * https://www.npmjs.com/package/nodejs-config
 */

var program = require('./cli');
var nodeJsConfig = require('nodejs-config');

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

module.exports = config;