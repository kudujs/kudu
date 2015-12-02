/* modules: 
 * https://www.npmjs.com/package/commander
 */

var program = require('commander');
var defaultConfig = require('./defaultAppConfig');

var commander = program
		.version(defaultConfig.version)
//.option('-p, --prod', 'Build production')
//.option('-d, --dev', 'Build development');
commander.parse(process.argv);

module.exports = program;