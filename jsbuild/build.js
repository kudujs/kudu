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
var archiver = require("archiver");

var buildDir = '../../buildtmp';
var distDir = "../../dist";

build();

function build() {
	createDist();
	return;

// Read in the build config file
	var rConfig = fs.readFileSync("./config/r.build.js", 'utf8');
	rConfig = eval(rConfig);

	var appConfig = config.get("app");

// Remove the deploy folder in case of previous builds
	clean(appConfig);

	optimize(rConfig, appConfig).then(function (buildResponse) {

		try {
			createDist();

			if (dirExists(appConfig.template)) {

				deployToTemplate(appConfig);
			}
			console.log("Build completed successfully!");

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
	glob(appConfig.template + '/*min*', function (er, files) {
		deleteFileArray(files);
	});

	// copy new kudu file
	glob(appConfig.dist + '/*min*', function (er, files) {
		for (var i = 0; i < files.length; i++) {
			var filename = path.basename(files[i]);
			var dest = appConfig.template + "/" + filename;
			fs.copySync(files[i], dest, {clobber: true});
		}
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

function createDist() {
	fs.removeSync(buildDir);
	fs.removeSync(distDir);
	fs.mkdir(distDir);

	fs.copySync("../dist", buildDir + "/kudu/dist");
	fs.copySync("../src", buildDir + "/kudu/src");
	fs.copySync("../jsbuild", buildDir + "/kudu/jsbuild");
	fs.copySync("../README.md", buildDir + "/kudu/README.md");

	var nwd = "../../";

	// coppySync trips over Windows symlink permissions, so using glob as a workaround to copy examples
	var files = glob.sync("kudu-examples/**/*", {cwd: nwd, nodir: true, ignore: ["**/node_modules/**", "**/META-INF/**", "**/kudulib/**", "**/dist/**", "**/build/**", "**/nbproject/**"]});
	//console.log(files);
	for (var i = 0; i < files.length; i++) {
		var file = files[i];
		var srcFile = nwd + file;
		var destFile = file.replace("kudu-examples", ""); // create relative dest file by removing prefix from src dile
		destFile = buildDir + "/examples" + "/" + destFile;
		fs.copySync(srcFile, destFile, {clobber: true});
	}

	var output = fs.createWriteStream(distDir + "/kudu." + config.version + ".zip");
	var archive = archiver.create('zip', {});
	archive.pipe(output);
	archive.bulk([
		{expand: true, cwd: buildDir, src: ['**/*']}
	]);
	archive.finalize();

}

function dirExists(path) {
	try	{
		return fs.statSync(path).isDir();
	} catch (err)
	{
		return false;
	}
}


console.log("Running build in", config.environment(), "mode");