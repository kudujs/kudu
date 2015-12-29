define(function (require) {

	//var $ = require("jquery");
	var jqfade = require("../utils/jqr/fade");

	function fade() {

		var that = {};

		that.intro = function (options, done) {
			var target = options.target;

			if (target == null) {
				throw new Error("options.target is not defined!");
			}

			var duration = options.duration || 'fast';

			if (options.firstView) {
				duration = 0;
			}
			
			var node = document.querySelector(options.target);
			jqfade.fadeIn(node, {duration: duration}, function () {
			//$(options.target).fadeIn(duration, function () {
				done();
			});
		};

		that.outro = function (options, done) {
			var target = options.target;

			if (target == null) {
				throw new Error("options.target is not defined!");
			}

			var duration = options.duration || 'fast';

			if (options.firstView) {
				duration = 0;
			}
			
			var node = document.querySelector(options.target);
			jqfade.fadeOut(node,  {duration: duration}, function () {
			//$(options.target).fadeOut(duration, function () {
				done();
			});
		}

		return that;
	}
	return fade();
});


