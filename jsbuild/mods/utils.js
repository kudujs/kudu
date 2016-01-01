var fs = require('fs-extra');

var utils = {
	dirExists: function (path) {
		try {
			var stat = fs.statSync(path);
			return stat.isDirectory();
		} catch (err) {
			return false;
		}
	}
};

module.exports = utils;