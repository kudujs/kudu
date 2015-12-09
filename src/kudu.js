// Events order
//    RACTIVE  -> CTRL       => GLOBAL EVENT
//			   ->            => viewBeforeInit
//			   -> onInit     => viewInit
//   render    -> onRender   => viewRender
//   complete  -> onComplete => viewComplete
//             -> onRemove
//                           => viewBeforeUnrender
//   unrender  -> onUnrender => viewUnrender
//   teardown
//   
//   -----
// viewFail - should this event be supported?

define(function (require) {

	var router = require("./router/router");
	var $ = require("jquery");
	var Ractive = require("ractive");
	var ajaxTrackerFn = require("./utils/ajaxTracker");
	var simpleAjaxTrackerFn = require("./utils/simpleAjaxTracker");
	var onInitHandler = require("./lifecycle/onInitHandler");
	var onRemoveHandler = require("./lifecycle/onRemoveHandler");
	var setupViewEvents = require("./ractivelib/setupEvents");
	var setupDefaultViewEvents = require("./ractivelib/setupDefaultEvents");
	var introFn = require("./transition/intro");
	var outroFn = require("./transition/outro");
	var ractiveViewFactory = require("./ractivelib/RactiveViewFactory");
	//var unrenderView = require("./ractivelib/render/unrender");
	var severity = require("./utils/severity");
	var utils = require("./utils/utils");

	function kudu() {

		var that = {};

		// 
		var reenableAnimationTracker = {enable: true};

		//var routes;

		var currentMVC = {
			view: null,
			ctrl: null,
			requestTracker: {active: true},
			route: null,
			options: null
		};

		var callstack = [];

		var initOptions = {
			target: null,
			routes: null,
			defaultRoute: null,
			unknownRouteResolver: null,
			intro: null,
			outro: null,
			fx: false,
			viewFactory: ractiveViewFactory,
			debug: true
		};

		var ajaxTracker = ajaxTrackerFn(that);

		that.init = function (options) {
			$.extend(initOptions, options);
			that.validateInitOptions(initOptions);
			
			  Ractive.DEBUG = initOptions.debug;

			router.on('routeload', function (routeOptions) {
				that.routeLoaded(routeOptions);
			});

			setupDefaultViewEvents(options);

			router.init({
				routes: initOptions.routes,
				defaultRoute: options.defaultRoute,
				unknownRouteResolver: options.unknownRouteResolver
			});
		};
		
		that.router = function() {
			return router;
		};
		
		that.validateInitOptions = function(options) {
			if (options.viewFactory == null) {
				throw new Error("viewFactory cannot be null!");
			}
			if (options.viewFactory.createView == null) {
				throw new Error("viewFactory must provide a createView function!");
			}
			if (options.viewFactory.renderView == null) {
				throw new Error("viewFactory must provide a renderView function!");
			}
			if (options.viewFactory.unrenderView == null) {
				throw new Error("viewFactory must provide an unrenderView function!");
			}			
		};

		that.go = function (options) {
			router.go(options);
		};

		that.getDefaultTarget = function () {
			return initOptions.target;
		};
		
		that.getActiveRoute = function () {
			return currentMVC.route;
		};

		that.routeLoaded = function (options) {

			try {
				callstack.push(1);

				options.target = options.target || initOptions.target;
				options.routeParams = options.routeParams || {};
				options.args = options.args || {};
				options.ajaxTracker = simpleAjaxTrackerFn.create(ajaxTracker, options);

				//options.requestTracker = currentMVC.requestTracker;
				options.mvc = $.extend({}, currentMVC);

				// cancel and cleanup current view request (if there is one)
				cancelCurrentRequest(options);

				// Create a requestTracker for the new view
				var requestTracker = {active: true};
				currentMVC.requestTracker = requestTracker;
				options.mvc.requestTracker = requestTracker;

				// Disable transitions if view requests overwrite one another, eg when another view request is being processed still
				if (callstack.length > 1) {
					$.fx.off = true;
					$(options.target).stop(true, true);
					reenableAnimationTracker.enable = false;
				}

				var ctrl = that.createController(options.module);
				options.ctrl = ctrl;
				delete options.module;
				//options.requestTracker = currentMVC.requestTracker;

				if (currentMVC.ctrl == null) {
					// No view rendered so skip removing the current view and just init the new view
					processOnInit(options).then(function () {

					}, function () {
						// processOnInit failed
						cancelCurrentRequest(options);

						var arg1 = arguments[0];
						if (arg1 != null && arg1.level < severity.ERROR) {
						} else {
							//TODO should viewFailed be called like this with args: var args = Array.slice.call( arguments );
							viewFailed(options, arguments);
						}
					});

				} else {

					processOnRemove(options).then(function () {
						processOnInit(options).then(function () {

						}, function () {
							// processOnInit failed
							cancelCurrentRequest(options);

							var arg1 = arguments[0];
							if (arg1 != null && arg1.level < severity.ERROR) {
							} else {
								//TODO should viewFailed be called like this with args: var args = Array.slice.call( arguments );
								viewFailed(options, arguments);
							}
						});
					}, function () {
						// processOnRemove failed
						cancelCurrentRequest(options);
						viewFailed(options, arguments);
					});
				}

			} catch (e) {
				viewFailed(options, [e]);
			}
		};

		that.createController = function (Module) {
			if (Module instanceof Function) {
				// Instantiate new view
				var result = new Module();
				if (result.id == null) {
					setId(result, Module.id);
				}
				return result;

			} else {
				// Module is not a Function, so assume it is an object and thus already instantiated
				return Module;
			}
		};

		that.processNewView = function (options) {
			var deferred = $.Deferred();
			var promise = deferred.promise();

			setupViewEvents(options);

			var renderer;

			if (options.route.enter == null && (currentMVC.route == null || currentMVC.route.leave == null)) {
				renderer = that.renderViewWithAnimation;
			} else {
				renderer = that.customRenderView;
			}

			renderer(options).then(function () {
				that.callViewEvent("onComplete", options);
				that.triggerEvent("viewComplete", options);
				deferred.resolve(options.view);

			}, function (error, view) {
				//viewFailed(options, [error]);
				// render Ractive rejeced
				//deferred.reject(error);
				deferred.reject(error, view);
			});

			// Request could have been overwritten by new request. Ensure this is still the active request
			if (!options.mvc.requestTracker.active) {
				deferred.reject("Request overwritten by another view request");
			}

			return promise;
		};

		that.callViewEvent = function (eventName, options) {

			var ctrl = options.ctrl;
			if (typeof ctrl[eventName] == 'function') {
				var viewOptions = {
					routeParams: options.routeParams,
					args: options.args,
					view: options.view,
					ajaxTracker: options.ajaxTracker
				};
				ctrl[eventName](viewOptions);
			}
		};

		that.triggerEvent = function (eventName, options) {
			options = options || {};
			options.mvc = options.mvc || {};

			var isMainCtrlReplaced = initOptions.target === options.target;

			// If no controller has been defined, create a dummy one to pass to the event
			var ctrl = options.ctrl;
			if (ctrl == null) {
				ctrl = {};
			}

			var triggerOptions = {
				//oldCtrl: currentMVC.ctrl,
				oldCtrl: options.mvc.ctrl,
				newCtrl: ctrl,
				isMainCtrl: isMainCtrlReplaced,
				ctrlOptions: options,
				eventName: eventName,
				error: options.error
			};

			$(that).trigger(eventName, [triggerOptions]);
		};

		function processOnInit(options) {
			var deferred = $.Deferred();
			var promise = deferred.promise();

			var onInitOptions = {
				ctrl: options.ctrl,
				routeParams: options.routeParams,
				args: options.args,
				mvc: options.mvc,
				ajaxTracker: options.ajaxTracker,
				target: options.target
			};

			that.triggerEvent("viewBeforeInit", options);

			onInitHandler(onInitOptions).then(function (viewOrPromise) {

				options.viewOrPromise = viewOrPromise;
				that.createView(options).then(function (view) {

					options.view = view;
					options.kudu = that;
					that.triggerEvent("viewInit", options);

					that.processNewView(options).then(function (view) {

						onInitComplete();
						deferred.resolve();

					}, function () {
						// processNewView rejected
						onInitComplete();
						deferred.reject.apply(deferred, arguments);
					});

				}, function () {
					// view creation rejected
					onInitComplete();
					deferred.reject.apply(deferred, arguments);
					//deferred.reject(arguments);
				});

			}, function () {
				// onInitHandler rejected

				onInitComplete();
				deferred.reject.apply(deferred, arguments);
			});

			return promise;
		}

		function processOnRemove(options) {
			var deferred = $.Deferred();
			var promise = deferred.promise();

			var onRemoveOptions = {
				ctrl: currentMVC.ctrl,
				view: currentMVC.view,
				routeParams: currentMVC.options.routeParams,
				args: currentMVC.options.args,
				//requestTracker: currentMVC.requestTracker,
				mvc: options.mvc,
				ajaxTracker: currentMVC.options.ajaxTracker,
				target: currentMVC.options.target
						//kudu: that
			};

			onRemoveHandler(onRemoveOptions).then(function () {

				that.triggerEvent("viewBeforeUnrender", options);

				deferred.resolve();

			}, function () {
				// ctrl.onRemove failed or cancelled
				//options.view.transitionsEnabled = true;

				if (currentMVC.view != null) {
					currentMVC.view.transitionsEnabled = true;
				}
				deferred.reject.apply(deferred, arguments);
			});

			return promise;
		}

		that.enter = function (options) {
			var deferred = $.Deferred();
			var promise = deferred.promise();

			var introOptions = {
				duration: 'fast',
				target: options.target,
				intro: initOptions.intro,
				fx: initOptions.fx || false
			};

			if (currentMVC.ctrl == null) {
				introOptions.firstView = true;
			}

			that.renderView(options).then(function () {

				introFn(introOptions).then(function () {
					deferred.resolve(options.view);
				});

			}, function (error, view) {
				// render Ractive rejeced
				deferred.reject(error, view);
			});

			return promise;
		};

		that.leave = function (options) {

			var deferred = $.Deferred();
			var promise = deferred.promise();

			var outroOptions = {
				duration: 100,
				target: options.target,
				outro: initOptions.outro,
				fx: initOptions.fx || false
			};

			if (currentMVC.ctrl == null) {
				outroOptions.firstView = true;
				outroOptions.duration = 0;
			}

			outroFn(outroOptions).then(function () {
				if (!options.mvc.requestTracker.active) {
					deferred.reject("Request overwritten by another view request", options.view);
					return;
				}

				that.unrenderView(options).then(function () {
					deferred.resolve(options.view);

				}, function (error, view) {
					deferred.reject(error, view);
				});
			});

			return promise;
		};

		that.renderViewWithAnimation = function (options) {
			var deferred = $.Deferred();
			var promise = deferred.promise();

			that.leave(options).then(function () {
				that.enter(options).then(function () {
					deferred.resolve(options.view);
				}, function (error, view) {
					// render Ractive rejeced
					deferred.reject(error, view);
				});
			}, function (error, view) {
				// render Ractive rejeced
				deferred.reject(error, view);
			});

			/*
			 
			 var outroOptions = {
			 duration: 100,
			 target: options.target,
			 outro: initOptions.outro
			 };
			 var introOptions = {
			 duration: 'fast',
			 target: options.target,
			 intro: initOptions.intro
			 };
			 if (currentMVC.ctrl == null) {
			 outroOptions.firstView = introOptions.firstView = true;
			 outroOptions.duration = 0;
			 }
			 
			 outroFn(outroOptions).then(function () {
			 if (!options.mvc.requestTracker.active) {
			 deferred.reject("Request overwritten by another view request");
			 return;
			 }
			 
			 that.unrenderView(options).then(function () {
			 
			 that.renderView(options).then(function () {
			 
			 introFn(introOptions).then(function () {
			 deferred.resolve(options.view);
			 });
			 
			 }, function (error, view) {
			 // render Ractive rejeced
			 deferred.reject(error, view);
			 });
			 
			 }, function (error, view) {
			 deferred.reject(error, view);
			 });
			 });
			 */

			return promise;
		};

		that.customLeave = function (options) {
			var deferred = $.Deferred();
			var promise = deferred.promise();

			var leaveOptions = {
				ctrl: options.ctrl,
				prevCtrl: currentMVC.ctrl,
				view: options.view,
				prevView: currentMVC.view,
				route: options.route,
				prevRoute: currentMVC.route,
				target: options.target
			};

			var leaveFn;
			var leaveCleanupFn;

			if (options.mvc.view == null) {
				// No view rendered yet, so we stub the leaveFn
				leaveFn = function () {
				};
				leaveCleanupFn = utils.noopPromise;

			} else {

				if (currentMVC.route != null) {
					leaveFn = currentMVC.route.leave;
					leaveCleanupFn = that.unrenderViewCleanup;
				}

				// If leave not defined or there is no view to unreder, fallback to unrenderView
				if (leaveFn == null) {
					//leaveFn = that.unrenderView;
					leaveFn = that.leave;

					//Since we unrederView we don't need to perform unrenderCleanup, so we stub it out
					leaveCleanupFn = utils.noopPromise;

					leaveOptions = options; // set leaveOptions to options, since we are going to use unrenderView instead
				}
			}

			var leavePromise = leaveFn(leaveOptions);
			if (leavePromise == null) {
				leavePromise = utils.noopPromise();
			}

			leavePromise.then(function () {

				leaveCleanupFn(options).then(function () {
					if (!options.mvc.requestTracker.active) {
						deferred.reject("Request overwritten by another view request", options.mvc.view);
						return;
					}

					deferred.resolve();

				}, function (error) {
					deferred.reject(error, options.view);
				});

			}, function () {
				deferred.reject("Error during route.leave()");
			});

			return promise;
		};

		that.customEnter = function (options) {
			var deferred = $.Deferred();
			var promise = deferred.promise();

			var enterOptions = {
				ctrl: options.ctrl,
				prevCtrl: currentMVC.ctrl,
				view: options.view,
				prevView: currentMVC.view,
				route: options.route,
				prevRoute: currentMVC.route,
				target: options.target
			};

			var enterFn = options.route.enter;
			var enterCleanupFn = that.renderViewCleanup;

			// If enter not defined, fallback to renderView
			if (enterFn == null) {
				enterFn = that.enter;
				//enterFn = that.renderView;

				//Since we unrederView we don't need to perform unrenderCleanup, so we stub it out
				enterCleanupFn = utils.noopPromise;

				enterOptions = options; // set leaveOptions to options, since we are going to use unrenderView instead
			}

			var enterPromise = enterFn(enterOptions);
			if (enterPromise == null) {
				enterPromise = utils.noopPromise();
			}

			enterPromise.then(function () {

				enterCleanupFn(options).then(function () {
					deferred.resolve(options.view);

				}, function (error) {
					deferred.reject(error, options.view);
				});

			}, function () {
				deferred.reject("Error during route.enter()");
			});

			return promise;
		};

		// User provided rendering during route setup
		that.customRenderView = function (options) {
			var deferred = $.Deferred();
			var promise = deferred.promise();

			that.customLeave(options).then(function () {

				that.customEnter(options).then(function () {

					deferred.resolve(options.view);

				}, function (error, view) {
					deferred.reject(error, view);
				});

			}, function (error, view) {
				deferred.reject(error, view);
			});

			return promise;
		};

		that.createView = function (options) {
			var promise = initOptions.viewFactory.createView(options);
			return promise;
		};

		that.renderView = function (options) {
			var deferred = $.Deferred();
			var promise = deferred.promise();

			//options.view.transitionsEnabled = false;

			var renderPromise = initOptions.viewFactory.renderView(options);

			renderPromise.then(function () {

				that.renderViewCleanup(options).then(function () {

					deferred.resolve(options.view);

				}, function (error) {
					deferred.reject(error, options.view);
				});


			}, function (error) {
				deferred.reject(error, options.view);
			});

			return promise;
		};

		that.renderViewCleanup = function (options) {
			var deferred = $.Deferred();
			var promise = deferred.promise();

			// Store new controller and view on currentMVC
			that.updateMVC(options);

			//options.view.transitionsEnabled = true;

			// Seems that Ractive render swallows errors so here we catch and log errors thrown by the viewRender event
			try {
				that.callViewEvent("onRender", options);
				that.triggerEvent("viewRender", options);

			} catch (error) {
				deferred.reject(error);
				return promise;
			}
			deferred.resolve();
			return promise;
		};

		that.unrenderView = function (options) {
			var deferred = $.Deferred();
			var promise = deferred.promise();

			if (options.mvc.view == null) {
				// No view to unrender
				deferred.resolve();

			} else {

				//options.mvc.view.transitionsEnabled = false;
				var unrenderPromise = initOptions.viewFactory.unrenderView(options);

				unrenderPromise.then(function () {
					//options.mvc.view.unrender().then(function () {

					that.unrenderViewCleanup(options).then(function () {

						if (!options.mvc.requestTracker.active) {
							deferred.reject("Request overwritten by another view request", options.mvc.view);
							return;
						}

						deferred.resolve(options.mvc.view);

					}, function (error) {
						deferred.reject(error, options.view);
					});

				}, function () {

					deferred.reject(options.mvc.view);

				});
			}

			return promise;
		};

		that.unrenderViewCleanup = function (options) {
			var deferred = $.Deferred();
			var promise = deferred.promise();

			// Seems that Ractive unrender swallows errors so here we catch and log errors thrown by the viewUnrender event
			try {
				that.callViewEvent("onUnrender", options);
				that.triggerEvent("viewUnrender", options);

			} catch (error) {
				deferred.reject(error);
				return promise;
			}

			deferred.resolve();
			return promise;
		};

		that.updateMVC = function (options) {
			currentMVC.view = options.view;
			currentMVC.ctrl = options.ctrl;
			currentMVC.options = options;
			currentMVC.route = options.route;
		};

		function onInitComplete() {
			callstack.splice(0, 1);
			if (callstack.length === 0) {
				//console.log("AT 0");

				// Delay switching on animation incase user is still clicking furiously
				reenableAnimationTracker.enable = false;
				reenableAnimationTracker = {enable: true};
				reenableAnimations(reenableAnimationTracker);
			} else {
				//console.log("AT ", callstack.length);
			}
		}

		function reenableAnimations(reenableAnimationTracker) {
			// We wait a bit before enabling animations in case user is still thrashing UI.
			setTimeout(function () {
				if (reenableAnimationTracker.enable) {
					$.fx.off = false;
				}
			}, 350);
		}

		/*
		 function setupRoutesByPaths(routes) {
		 for (var key in routes) {
		 if (routes.hasOwnProperty(key)) {
		 var route = routes[key];
		 that.addRouteByPath(route);
		 }
		 }
		 }*/

		function viewFailed(options, errorArray) {
			var errors = errorArray;
			if (!$.isArray(errorArray)) {
				errors = Array.prototype.slice.call(errorArray);
			}
			options.error = errors;
			that.triggerEvent("viewFail", options);

			if (initOptions.debug) {
				if (options.error.length === 0) {
					console.error("error occurred!", options);

 				} else {
					console.error(options.error[0], options);
				}
			}
		}

		function cancelCurrentRequest(options) {

			// Check if request has already been overwritten
			if (options.mvc.requestTracker.active === false) {
				return;
			}

			// current controller has been overwritten by new request
			options.mvc.requestTracker.active = false;

			ajaxTracker.abort(options.target);
			ajaxTracker.clear(options.target);

		}

		function setId(obj, id) {
			// Create an ID property which isn't writable or iteratable through for in loops.
			if (!obj.id) {
				Object.defineProperty(obj, "id", {
					enumerable: false,
					writable: false,
					value: id
				});
			}
		}

		return that;
	}

	var result = kudu();
	return result;
});
