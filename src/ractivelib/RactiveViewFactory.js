define(function (require) {

	var createView = require("./render/create");
	var renderView = require("./render/render");
	var unrenderView = require("./render/unrender");

	function ractiveViewFactory() {

		var that = {};

		that.createView = function (options) {
			return createView(options);

		};
		
		that.renderView = function (options) {
			return renderView(options);
		};
		
		that.unrenderView = function (options) {
			return unrenderView(options);
		};

		return that;
	}
	return new ractiveViewFactory();
});