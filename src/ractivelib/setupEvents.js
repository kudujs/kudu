define(function (require) {

	//var $ = require("jquery");

	function setupEvents(options) {
		// Guard against if view is not a ractive instance
		if (!options.view.off) {
			return;
		}

		/*
		var triggerOptions = {
			routeParams: options.routeParams,
			args: options.args,
			view: options.view,
			ctrl: options.ctrl,
			ajaxTracker: options.ajaxTracker,
			mvc: options.mvc
		};

		var viewOptions = {
			routeParams: options.routeParams,
			args: options.args,
			view: options.view,
			ajaxTracker: options.ajaxTracker
		};*/

		// Add callback events
		options.view.off('complete');
		options.view.off('render');
		options.view.off('unrender');
		options.view.off('teardown');

		options.view.on('complete', function () {
			// switch on transitions that was disabled in kudu during rendering of the view.
			//this.transitionsEnabled = true;
			/*
			if (typeof options.ctrl.onComplete == 'function') {
				options.ctrl.onComplete(viewOptions);
			}*/
			//options.kudu.triggerEvent("complete", triggerOptions);
		});

		options.view.on('render', function () {
			//console.log("onrender");
			/*
			if (typeof options.ctrl.onRender == 'function') {
				options.ctrl.onRender(viewOptions);
			}*/
			//options.kudu.triggerEvent("render", triggerOptions);
		});

		options.view.on('unrender', function () {
			/*
		}
			if (typeof options.ctrl.onUnrender == 'function') {
				options.ctrl.onUnrender(viewOptions);
			}
			options.kudu.triggerEvent("unrender", triggerOptions);
			*/
		});

		options.view.on('teardown', function () {
			//console.log("onteardown");
			//options.kudu.triggerEvent("teardown", triggerOptions);
		});

		var that = {};



		return that;
	}
	return setupEvents;
});