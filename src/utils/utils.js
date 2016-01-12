define(function (require) {

	require("./jqr/npo");

	function utils(options) {

		var that = {};


		var noopPromiseFn = new Promise(function (resolve, reject) {
			resolve();
		});

		that.noopPromise = function () {
			return noopPromiseFn;
		}

		that.isPromise = function (o) {
			if (o == null) {
				return false;
			}

			if (typeof o.then === 'function') {
				return true;
			}
			return false;
		}

		that.isRactiveObject = function (o) {
			if ((typeof o == "object") && (o !== null)) {
				if (o._guid != null) {
					return true;
				}
				return false;
			}
			return false;
		}

		that.objectLength = function (o) {
			if (Object.keys) {
				return Object.keys(o).length;
			}

			var count = 0;
			var prop;
			for (prop in o) {
				if (o.hasOwnProperty(prop)) {
					count++;
				}
			}
		};

		return that;
	}

	var utils = utils();
	return utils;

});