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

	try {
		deployToTemplate(appConfig);
		console.log("Build completed successfully!");

	} catch (e) {
		console.error(e.stack);
	}
});

function clean(config) {
	fs.removeSync(config.dist);
	console.log("Removed previous buildpath: " + config.dist);
}

function deployToTemplate(appConfig) {
	// delete current kudu file
	glob(appConfig.template + '/*min*', function (er, files) {
		deleteFileArray(files);
	});
	
	// copy new kudu file
	glob(appConfig.dist + '/*min*', function (er, files) {
		copyFileArray(files, appConfig.template, {clobber: true});
	});

	console.log("Copied dist:'" + appConfig.dist + "' to template: '" + appConfig.template + "'");
	
	// update config.js
	replaceInFile(appConfig.template + "/../app/config/config.js", '.*"kudu":.*', '\t\t"kudu": "kudu.min",');
}

function replaceInFile(file, search, replaceWith) {
	var regexp = new RegExp(search);
	var data = fs.readFileSync(file, 'utf8');
	data = data.replace(regexp, replaceWith);
	fs.writeFileSync(file, data);
}

function deleteFileArray(files, options) {
	if (files == null) {
		console.log("no files to delete");
		return;
	}
	if (!Array.isArray(files)) {
		console.log("files is not an array!");
		return;
	}

	for (var i = 0; i < files.length; i++) {
		fs.removeSync(files[i], options);
	}
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