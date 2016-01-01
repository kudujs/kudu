/* modules: 
 * https://www.npmjs.com/package/commander
 */

var archiver = require("archiver");
var glob = require('glob');
var fs = require('fs-extra');
var utils = require('./utils');

var buildTmpDir = '../buildtmp';

function create(appConfig) {
	var promise = new Promise(function (resolve, reject) {
		fs.removeSync(buildTmpDir);
		if (!utils.dirExists(appConfig.dist)) {
			fs.mkdirSync(appConfig.dist);
		}

		fs.copySync("../dist", buildTmpDir + "/kudu/dist");
		fs.copySync("../src", buildTmpDir + "/kudu/src");
		fs.copySync("../jsbuild", buildTmpDir + "/kudu/jsbuild");
		fs.copySync("../README.md", buildTmpDir + "/kudu/README.md");
		fs.copySync("./README.dist.md", buildTmpDir + "/README.md");

		var nwd = "../../";

		// coppySync trips over Windows symlink permissions, so using glob as a workaround to copy examples
		var files = glob.sync("kudu-examples/**/*", {cwd: nwd, nodir: true, ignore: ["**/node_modules/**", "**/META-INF/**", "**/kudulib/**", "**/dist/**", "**/build/**", "**/nbproject/**"]});
		//console.log(files);
		for (var i = 0; i < files.length; i++) {
			var file = files[i];
			var srcFile = nwd + file;
			var destFile = file.replace("kudu-examples", ""); // create relative dest file by removing prefix from src dile
			destFile = buildTmpDir + "/examples" + "/" + destFile;
			fs.copySync(srcFile, destFile, {clobber: true});
		}

		var output = fs.createWriteStream(appConfig.dist + "/kudu." + appConfig.version + ".zip");
		var archive = archiver.create('zip', {});

		archive.on('end', function () {
			console.log('Kudu.zip has been created!');

			// cleanup
			fs.removeSync(buildTmpDir);

			resolve();
		});

		archive.on('error', function (err) {
			console.error(err.stack);
			reject(err);
		});


		archive.pipe(output);
		archive.bulk([
			{expand: true, cwd: buildTmpDir, src: ['**/*']}
		]);
		archive.finalize();

	});
	return promise;

}

module.exports = create;