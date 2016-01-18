// Events order
//    RACTIVE  -> CTRL       => GLOBAL EVENT
//             -> onRemove   => remove             (old view)
//                           => beforeUnrender     (old view)
//			   ->            => beforeInit         (new view)
//			   -> onInit     => init               (new view)
//   unrender  -> onUnrender => unrender           (old view)
//   render    -> onRender   => render             (new view)
//   complete  -> onComplete => complete           (new view)
//   
//   -----
// viewFail - should this event be supported?

define(function (require) {

	var router = require("./router/router");
	require("./utils/jqr/npo");
	var Ractive = require("ractive");
	var ajaxTrackerFn = require("./utils/at/ajaxTracker");
	var simpleAjaxTrackerFn = require("./utils/at/simpleAjaxTracker");
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
	var jqutils = require("./utils/jqr/jqutils");
	var EventEmitter = require("./utils/jqr/EventEmitter");
	var jqfade = require("./utils/jqr/fade");

	function kudu() {

		var that = new EventEmitter();

		var reenableAnimationTracker = {enable: true};

		// Ractive unrender workaround. We store the current options temporarily so we can invoke forceUnrender which is added to the options
		// in unrender.js
		var _tempOptions = {};

		var currentMVC = {
			view: null,
			ctrl: null,
			requestTracker: {active: true},
			route: null,
			options: {
				routeParams: null,
				args: null,
				forceUnrender: null
			}
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

		var ajaxTrackerOptions = {
			kudu: that,
			wrappers: {}
		};
		var ajaxTracker = ajaxTrackerFn(ajaxTrackerOptions);

		that.init = function (options) {
			if (options == null) {
				throw new Error("kudu.init() requires options!");
			}
			initOptions = jqutils.extend({}, initOptions, options);
			that.validateInitOptions(initOptions);

			Ractive.DEBUG = initOptions.debug;

			router.on('routeload', function (routeOptions) {
				if (that.getActiveRoute() == null) {
					routeOptions.initialRoute = true;
				} else {
					routeOptions.initialRoute = false;
				}
				that.routeLoaded(routeOptions);
			});

			setupDefaultViewEvents(options);

			router.init({
				routes: initOptions.routes,
				defaultRoute: options.defaultRoute,
				unknownRouteResolver: options.unknownRouteResolver
			});
		};

		that.router = function () {
			return router;
		};

		that.validateInitOptions = function (options) {
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

		that.getActiveView = function () {
			return currentMVC.view;
		};

		that.getActiveController = function () {
			return currentMVC.ctrl;
		};

		that.routeLoaded = function (options) {

			try {
				callstack.push(1);

				options.target = options.target || initOptions.target;
				options.routeParams = options.routeParams || {};
				options.args = options.args || {};
				options.ajaxTracker = simpleAjaxTrackerFn.create(ajaxTracker, options);

				//options.requestTracker = currentMVC.requestTracker;
				options.mvc = jqutils.extend({}, currentMVC);

				// cancel and cleanup current view request (if there is one)
				cancelCurrentRequest(options);

				// Create a requestTracker for the new view
				var requestTracker = {active: true};
				currentMVC.requestTracker = requestTracker;
				options.mvc.requestTracker = requestTracker;

				// Disable transitions if view requests overwrite one another, eg when another view request is being processed still
				if (callstack.length > 1) {
					if (_tempOptions.forceUnrender) {
						_tempOptions.forceUnrender();
					}

					jqfade.off(true);
					jqfade.stop();
					reenableAnimationTracker.enable = false;
				}
				// Ractive unrender workaround. We store the current options temporarily so we can invoke forceUnrender, if the
				// request is overwritten
				_tempOptions = options;

				var ctrl = that.createController(options.module);
				options.ctrl = ctrl;
				delete options.module;
				//options.requestTracker = currentMVC.requestTracker;

				if (currentMVC.ctrl == null) {
					// No view rendered so skip removing the current view and just init the new view
					processOnInit(options).then(function () {

					}).catch(function () {
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


						}).catch(function () {
							// processOnInit failed
							cancelCurrentRequest(options);

							var arg1 = arguments[0];
							if (arg1 != null && arg1.level < severity.ERROR) {
							} else {
								//TODO should viewFailed be called like this with args: var args = Array.slice.call( arguments );
								viewFailed(options, arguments);
							}
						});
					}).catch(function () {
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
			var promise = new Promise(function (resolve, reject) {
				setupViewEvents(options);

				var renderer;

				if (options.route.enter == null && (currentMVC.route == null || currentMVC.route.leave == null)) {
					renderer = that.renderViewWithAnimation;
				} else {
					renderer = that.customRenderView;
				}

				renderer(options).then(function () {
					that.callViewEvent("onComplete", options);
					that.triggerEvent("complete", options);
					resolve(options.view);

				}).catch(function (error, view) {
					//viewFailed(options, [error]);
					// render Ractive rejeced
					//deferred.reject(error);
					reject(error, view);
				});

				// Request could have been overwritten by new request. Ensure this is still the active request
				if (!options.mvc.requestTracker.active) {
					reject.apply(undefined, ["Request overwritten by another view request in [ProcessNewView]", options.mvc.view]);
				}
			});

			return promise;
		};

		that.callViewEvent = function (eventName, options) {

			var ctrl = options.ctrl;
			if (typeof ctrl[eventName] == 'function') {

				var currOptions = {
					ajaxTracker: options.ajaxTracker,
					routeParams: options.routeParams,
					args: options.args,
					view: options.view,
					ctrl: options.ctrl,
					route: options.route
				};

				var prevOptions = {
					ajaxTracker: options.mvc.options.ajaxTracker, // TODO test this
					ctrl: options.mvc.ctrl,
					route: options.mvc.route,
					routeParams: options.mvc.options.routeParams,
					args: options.mvc.options.args,
					view: options.mvc.view
				};

				var eventOptions = {};

				if (eventName === 'onUnrender') {

					eventOptions = prevOptions;
					eventOptions.next = currOptions;

				} else {
					eventOptions = currOptions;
					eventOptions.prev = prevOptions;
				}

				ctrl[eventName](eventOptions);
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

			var currOptions = {
				ajaxTracker: options.ajaxTracker,
				routeParams: options.routeParams,
				args: options.args,
				view: options.view,
				ctrl: options.ctrl,
				route: options.route
			};

			var prevOptions = {
				ajaxTracker: options.mvc.options.ajaxTracker, // TODO test this
				ctrl: options.mvc.ctrl,
				route: options.mvc.route,
				routeParams: options.mvc.options.routeParams,
				args: options.mvc.options.args,
				view: options.mvc.view
			};

			var triggerOptions = {};
			/*
			 ctrl: options.ctrl,
			 view: options.view,
			 args: options.args,
			 routeParams: options.routeParams,
			 route: options.route,
			 isMainCtrl: isMainCtrlReplaced,
			 //ctrlOptions: options,
			 eventName: eventName,
			 error: options.error,
			 initialRoute: options.initialRoute
			 };*/

			if (eventName === 'remove' || eventName === 'beforeUnrender' || eventName === 'unrender') {
				triggerOptions = prevOptions;
				triggerOptions.next = currOptions;

			} else if (eventName === 'fail') {
				triggerOptions = prevOptions;
				triggerOptions.prev = prevOptions;
				triggerOptions.next = currOptions;

			} else {
				triggerOptions = currOptions;
				triggerOptions.prev = prevOptions;
			}

			/*
			 var triggerOptions = {
			 //oldCtrl: currentMVC.ctrl,
			 oldCtrl: options.mvc.ctrl,
			 newCtrl: ctrl,
			 isMainCtrl: isMainCtrlReplaced,
			 ctrlOptions: options,
			 eventName: eventName,
			 error: options.error,
			 initialRoute: options.initialRoute
			 };*/

			var prefix = 'lc.';
			that.emit(prefix + eventName, triggerOptions);

			// Call events defined as go() options
			if (options[eventName]) {
				options[eventName](triggerOptions);
			}
		};

		function processOnInit(options) {
			var promise = new Promise(function (resolve, reject) {

				var onInitOptions = {
					route: options.route,
					ctrl: options.ctrl,
					routeParams: options.routeParams,
					args: options.args,
					mvc: options.mvc,
					ajaxTracker: options.ajaxTracker,
					target: options.target,
					prev: {
						ajaxTracker: options.mvc.options.ajaxTracker,
						ctrl: options.mvc.ctrl,
						route: options.mvc.route,
						routeParams: options.mvc.options.routeParams,
						view: options.mvc.view,
						args: options.mvc.options.args
					}
				};
				that.triggerEvent("beforeInit", options);

				onInitHandler(onInitOptions).then(function (viewOrPromise) {

					options.viewOrPromise = viewOrPromise;
					that.createView(options).then(function (view) {

						options.view = view;
						options.kudu = that;
						that.triggerEvent("init", options);

						that.processNewView(options).then(function (view) {

							onInitComplete();
							resolve();

						}).catch(function () {
							// processNewView rejected
							onInitComplete();
							reject.apply(undefined, arguments);
						});

					}).catch(function () {
						// view creation rejected
						onInitComplete();
						reject.apply(undefined, arguments);
						//deferred.reject(arguments);
					});

				}).catch(function () {
					// onInitHandler rejected

					onInitComplete();
					reject.apply(undefined, arguments);
					//deferred.reject(arguments);
				});
			});

			return promise;
		}

		function processOnRemove(options) {
			var promise = new Promise(function (resolve, reject) {

				var onRemoveOptions = {
					next: {
						ctrl: options.ctrl,
						route: options.route,
						view: options.view,
						args: options.args,
						routeParams: options.routeParams,
						ajaxTracker: options.ajaxTracker
					},
					ctrl: currentMVC.ctrl,
					route: currentMVC.route,
					view: currentMVC.view,
					routeParams: currentMVC.options.routeParams,
					args: currentMVC.options.args,
					mvc: options.mvc,
					ajaxTracker: currentMVC.options.ajaxTracker,
					target: currentMVC.options.target
							//kudu: that
				};

				onRemoveHandler(onRemoveOptions).then(function () {

					that.triggerEvent("remove", options);

					that.triggerEvent("beforeUnrender", options);

					resolve();

				}).catch(function () {
					// ctrl.onRemove failed or cancelled
					//options.view.transitionsEnabled = true;

					if (currentMVC.view != null) {
						//currentMVC.view.transitionsEnabled = true;
					}
					reject.apply(undefined, arguments);
				});
			});

			return promise;
		}

		that.enter = function (options) {
			var promise = new Promise(function (resolve, reject) {

				var introOptions = {
					duration: 'fast',
					target: options.target,
					intro: initOptions.intro,
					fx: initOptions.fx || false
				};

				if (options.fx === true || options.fx === false) {
					introOptions.fx = options.fx;
				}

				if (currentMVC.ctrl == null) {
					introOptions.firstView = true;
				}

				that.renderView(options).then(function () {

					introFn(introOptions).then(function () {
						resolve(options.view);
					}).catch(function (error, view) {
						// introFn rejeced
						reject.apply(undefined, [error, view]);
					});

				}).catch(function (error, view) {
					// render Ractive rejeced
					reject.apply(undefined, [error, view]);
				});
			});

			return promise;
		};

		that.leave = function (options) {

			var promise = new Promise(function (resolve, reject) {

				var outroOptions = {
					duration: 100,
					target: options.target,
					outro: initOptions.outro,
					fx: initOptions.fx || false
				};
				if (options.fx === true || options.fx === false) {
					outroOptions.fx = options.fx;
				}

				if (currentMVC.ctrl == null) {
					outroOptions.firstView = true;
					outroOptions.duration = 0;
				}

				outroFn(outroOptions).then(function () {
					if (!options.mvc.requestTracker.active) {
						reject.apply(undefined, ["Request overwritten by another view request in [outro]", options.mvc.view]);
						return;
					}

					that.unrenderView(options).then(function () {
						resolve(options.view);

					}).catch(function (error, view) {
						reject.apply(undefined, [error, view]);
					});
				}).catch(function (error) {
					reject.apply(undefined, [error, options.mvc.view]);
				});
			});

			return promise;
		};

		that.renderViewWithAnimation = function (options) {
			var promise = new Promise(function (resolve, reject) {

				that.leave(options).then(function () {
					that.enter(options).then(function () {
						resolve(options.view);
					}).catch(function (error, view) {
						// render Ractive rejeced
						reject.apply(undefined, [error, view]);
					});

				}).catch(function (error, view) {
					// render Ractive rejeced
					reject.apply(undefined, [error, view]);
				});
			});

			return promise;
		};

		that.customLeave = function (options) {
			var promise = new Promise(function (resolve, reject) {

				var leaveOptions = {
					ctrl: currentMVC.ctrl,
					view: currentMVC.view,
					route: currentMVC.route,
					next: {
						ctrl: options.ctrl,
						view: options.view,
						route: options.route,
					},
					target: options.target
				};

				var leaveFn;
				var leaveCleanupFn;

				if (options.mvc.view == null) {
					// No view rendered yet, so we stub the leaveFn
					leaveFn = function () {
					};
					leaveCleanupFn = function () {};

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
						leaveCleanupFn = function () {};

						leaveOptions = options; // set leaveOptions to options, since we are going to use unrenderView instead
					}
				}

				var leavePromise = leaveFn(leaveOptions);
				if (leavePromise == null) {
					leavePromise = utils.noopPromise();
				}

				leavePromise.then(function () {

					leaveCleanupFn(options);

					if (!options.mvc.requestTracker.active) {
						reject.apply(undefined, ["Request overwritten by another view request [leaveCleanUp]", options.mvc.view]);
						return;
					}

					resolve();


				}).catch(function () {
					reject("Error during route.leave()");
				});
			});

			return promise;
		};

		that.customEnter = function (options) {
			var promise = new Promise(function (resolve, reject) {

				var enterOptions = {
					ctrl: options.ctrl,
					view: options.view,
					route: options.route,
					prev: {
						ctrl: currentMVC.ctrl,
						view: currentMVC.view,
						route: currentMVC.route
					},
					target: options.target
				};

				var enterFn = options.route.enter;
				var enterCleanupFn = that.renderViewCleanup;

				// If enter not defined, fallback to renderView
				if (enterFn == null) {
					enterFn = that.enter;
					//enterFn = that.renderView;

					//Since we unrederView we don't need to perform unrenderCleanup, so we stub it out
					enterCleanupFn = function () {};

					enterOptions = options; // set leaveOptions to options, since we are going to use unrenderView instead
				}

				var enterPromise = enterFn(enterOptions);
				if (enterPromise == null) {
					enterPromise = utils.noopPromise();
				}

				enterPromise.then(function () {

					enterCleanupFn(options);
					resolve(options.view);

				}).catch(function () {
					reject("Error during route.enter()");
				});
			});

			return promise;
		};

		// User provided rendering during route setup
		that.customRenderView = function (options) {
			var promise = new Promise(function (resolve, reject) {

				that.customLeave(options).then(function () {

					that.customEnter(options).then(function () {

						resolve(options.view);

					}).catch(function (error, view) {
						reject.apply(undefined, [error, view]);
					});

				}).catch(function (error, view) {
					reject.apply(undefined, [error, view]);
				});
			});

			return promise;
		};

		that.createView = function (options) {
			var promise = initOptions.viewFactory.createView(options);
			return promise;
		};

		that.renderView = function (options) {
			var promise = new Promise(function (resolve, reject) {

				//options.view.transitionsEnabled = false;

				var renderPromise = initOptions.viewFactory.renderView(options);

				that.renderViewCleanup(options);

				renderPromise.then(function () {

					resolve(options.view);

				}).catch(function (error) {
					reject.apply(undefined, [error, options.view]);
				});
			});

			return promise;
		};

		that.renderViewCleanup = function (options) {

			// Store new controller and view on currentMVC
			that.updateMVC(options);

			that.callViewEvent("onRender", options);
			that.triggerEvent("render", options);
		};

		that.unrenderView = function (options) {
			var promise = new Promise(function (resolve, reject) {

				if (options.mvc.view == null) {
					// No view to unrender
					resolve();

				} else {

					//options.mvc.view.transitionsEnabled = false;
					var unrenderPromise = initOptions.viewFactory.unrenderView(options);

					unrenderPromise.then(function () {
						//options.mvc.view.unrender().then(function () {

						that.unrenderViewCleanup(options);

						if (!options.mvc.requestTracker.active) {
							reject.apply(undefined, ["Request overwritten by another view request in [unrenderView]", options.mvc.view]);
							return;
						}

						resolve(options.mvc.view);


					}).catch(function () {

						reject(options.mvc.view);

					});
				}
			});

			return promise;
		};

		that.unrenderViewCleanup = function (options) {
			that.callViewEvent("onUnrender", options);
			that.triggerEvent("unrender", options);
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
					jqfade.off(false);
				}
			}, 350);
		}

		function viewFailed(options, errorArray) {
			var errors = errorArray;
			if (!Array.isArray(errorArray)) {
				errors = Array.prototype.slice.call(errorArray);
			}
			options.error = errors;
			that.triggerEvent("viewFail", options);

			if (initOptions.debug) {
				if (options.error.length === 0) {
					console.error("error occurred!", options);

				} else {
					for (var i = 0; i < options.error.length; i++) {
						// Print stack trace if error is actual error with a stack property
						if (options.error[i].stack == null) {
							console.error(options.error[i]);

						} else {
							console.error(options.error[i].stack);
						}
					}
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
