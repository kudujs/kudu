define(function (require) {

	var $ = require("jquery");
	var Ractive = require("ractive");

	function setupDefaultEvents(options) {
		Ractive.defaults.onconstruct = function () {
			//console.error("OK", this);
		};

		var that = {};

		return that;
	}
	return setupDefaultEvents;
});