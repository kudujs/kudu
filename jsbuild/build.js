var cli = require('./mods/cli');
var config = require('./mods/config');
var optimize = require('./mods/optimize');
var zip = require('./mods/zip');
var utils = require('./mods/utils');
var fs = require('fs-extra');
var path = require('path');
var glob = require('glob');

build();

function build() {

// Read in the build config file
	var rConfig = fs.readFileSync("./config/r.build.js", 'utf8');
	rConfig = eval(rConfig);

	var appConfig = config.get("app");

// Remove the deploy folder in case of previous builds
	clean(appConfig);

	optimize(rConfig, appConfig).then(function (buildResponse) {

		try {

			zip(appConfig).then(function () {

				if (utils.dirExists(appConfig.template)) {

					deployToTemplate(appConfig);
					console.log("deployed kudu to java-template");
				}
				console.log("Build completed successfully!");

			}).catch(function(err) {
				console.error(err.stack)
			});


		} catch (e) {
			console.error(e.stack);
		}
	});
}

function clean(config) {
	fs.removeSync(config.dist);
	console.log("Removed previous buildpath: " + config.dist);
}

function deployToTemplate(appConfig) {
	// delete current kudu file
	var files = glob.sync(appConfig.template + '/*min*');
	deleteFileArray(files);

	// copy new kudu file
	files = glob.sync(appConfig.dist + '/*min*');
	for (var i = 0; i < files.length; i++) {
		var filename = path.basename(files[i]);
		var dest = appConfig.template + "/" + filename;
		fs.copySync(files[i], dest, {clobber: true});
	}

	console.log("Copied dist:'" + appConfig.dist + "' to template: '" + appConfig.template + "'");

	// update config.js
	replaceInFile(appConfig.template + "/../app/config/config.js", '.*"kudu":.*', '\t\t"kudu": "kudu.' + appConfig.version + '.min",');
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

console.log("Running build in", config.environment(), "mode");