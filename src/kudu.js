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
// fail - should this event be supported?

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
	var severity = require("./utils/severity");
	var utils = require("./utils/utils");
	var mode = require("./utils/mode");
	var jqutils = require("./utils/jqr/jqutils");
	var EventEmitter = require("./utils/jqr/EventEmitter");
	var jqfade = require("./utils/jqr/fade");

	function kudu() {

		var that = new EventEmitter();
		var origEmit = that.emit;

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

			mode.DEBUG = Ractive.DEBUG = initOptions.debug;

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
			// go() is asyncrounous
			// We wait a tick in case we want to redirect by calling go() from Controller.onInit() { kudu.go(...); return null}. 
			// If this function is not async, calling kudu.go from ctrl.onInit would cause two requests to run in parallel. By waiting a tick
			// the original ctrl request can complete before loading the new route
			setTimeout(function() {
				router.go(options);
			});
		};

		that.getId = function (obj) {
			if (obj == null) {
				return null;
			}
			return obj._kudu_id;
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
		
		that.getDefaultViewFactory = function () {
			return ractiveViewFactory;
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

				checkCallstack(_tempOptions);

				// Ractive unrender workaround. We store the current options temporarily so we can invoke forceUnrender, if the
				// request is overwritten
				_tempOptions = options;

				var ctrl = that.createController(options.module);
				options.ctrl = ctrl;
				delete options.module;
				//options.requestTracker = currentMVC.requestTracker;

				loadView(options);

			} catch (err) {
				viewFailed(options, err);
			}
		};
		
		function loadView( options ) {
			if ( currentMVC.ctrl == null ) {
				loadInitialView(options);

			} else {				
				changeView(options);
			}
		}
		
		function loadInitialView( options ) {
			// No view rendered so skip removing the current view and just init the new view
			processOnInit( options ).then( function () {

			} ).catch(function ( err ) {
				// processOnInit failed
				cancelCurrentRequest( options );
				utils.populateError(err, severity.ERROR, options);
				viewFailed( options, err );
			} );
		}

		function changeView( options ) {
			// Remove current view before loading new view

			processOnRemove( options ).then( function () {
				processOnInit( options ).then( function () {

				} ).catch(function (err) {
					// processOnInit failed
					cancelCurrentRequest( options );
					utils.populateError(err, severity.ERROR, options);
					viewFailed( options, err );
				} );

			} ).catch(function (err) {
				// processOnRemove failed
				cancelCurrentRequest( options );
				utils.populateError(err, severity.ERROR, options);
				viewFailed( options, err );
			} );
		}
		
		function checkCallstack(options) {
			// Disable transitions if view requests overwrite one another, eg when another view request is being processed still
			if ( callstack.length > 1 ) {
				if ( options.forceUnrender ) {
					options.forceUnrender();
				}

				jqfade.off( true );
				jqfade.stop();
				reenableAnimationTracker.enable = false;
			}
		}
		;

		that.createController = function (Module) {
			if (Module instanceof Function) {
				// Instantiate new view
				var result = new Module();
				if (result._kudu_id == null) {
					setId(result, Module._kudu_id);
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

				}).catch(function (err) {
					utils.populateError(err, severity.ERROR, options);
					reject(err);
				});

				// Request could have been overwritten by new request. Ensure this is still the active request
				if (!options.mvc.requestTracker.active) {
					var err = new Error("Request overwritten by another view request");
					utils.populateError(err, severity.WARN, options);
					reject(err);
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

		that.emit = function(that, evt) {
			if (typeof that === 'string') {
				var args = Array.prototype.slice.call(arguments);
				args.unshift(this);
				return origEmit.apply(this, args);
			}
			origEmit.apply(this, arguments);
			//(options.view, prefix + eventName, triggerOptions);
		};

		that.triggerEvent = function (eventName, options) {
			options = options || {};
			options.mvc = options.mvc || {};
			var context = null;

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
				context = prevOptions.view;

			} else if (eventName === 'fail') {
				triggerOptions = prevOptions;
				triggerOptions.prev = jqutils.extend({}, prevOptions); // triggerOptions references prevOptions, so make a reference to a
				// copy of preOptions instead of prevOptions itself, otherwise this creates a recursive link
				triggerOptions.next = currOptions;
				triggerOptions.error = options.error;
				
				if (prevOptions.view) {
					context = prevOptions.view;
				} else {
					context = currOptions.view;
				}

			} else {
				triggerOptions = currOptions;
				triggerOptions.prev = prevOptions;
				context = currOptions.view;
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
			that.emit(context, prefix + eventName, triggerOptions);

			// Call events defined as go() options
			if (options[eventName]) {
				options[eventName].call(context, triggerOptions);
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

						}).catch(function (err) {
							// processNewView rejected
							onInitComplete();

							utils.populateError(err, severity.ERROR, options);
							reject(err);
						});

					}).catch(function (err) {
						// view creation rejected
						onInitComplete();
						
						utils.populateError(err, severity.ERROR, options);
						reject(err);
					});

				}).catch(function (err) {
					// onInitHandler rejected
					onInitComplete();

					utils.populateError(err, severity.ERROR, options);					
					reject(err);
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

				}).catch(function (err) {
					// ctrl.onRemove failed or cancelled

					utils.populateError(err, severity.ERROR, options);
					reject(err);
				});
			});

			return promise;
		}

		that.enter = function (options) {
			// In case enter is called from a customized user option eg route.enter we check if _origOptions was set and use that instead of options
			if (options._origOptions) {
				options = options._origOptions;
			}

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
					// In case this method is called from a customized user option eg route.leave we check if _origOptions was set and use that instead of options
					if ( options._origOptions ) {
						options = options._origOptions;
					}

					introFn(introOptions).then(function () {

						resolve(options.view);

					}).catch(function (err) {
						// introFn rejeced
						utils.populateError(err, severity.ERROR, options);
						reject(err);
					});

				}).catch(function (err) {
					// render Ractive rejeced
					utils.populateError(err, severity.ERROR, options);
					reject(err);
				});
			});

			return promise;
		};

		that.leave = function (options) {
			// In case leave is called from a customized user option eg route.leave we check if _origOptions was set and use that instead of options
			if (options._origOptions) {
				options = options._origOptions;
			}

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
						var err = new Error("Request overwritten by another view request")
						utils.populateError(err, severity.WARN, options);
						reject(err);
						return;
					}

					that.unrenderView(options).then(function () {
						resolve(options.view);

					}).catch(function (err) {
						utils.populateError(err, severity.ERROR, options);
						reject(err);
					});

				}).catch(function (err) {

					 utils.populateError(err, severity.ERROR, options);
						reject(err);
				});
			});

			return promise;
		};

		that.renderViewWithAnimation = function (options) {
			// In case this method is called from a customized user option eg route.leave we check if _origOptions was set and use that instead of options
			if ( options._origOptions ) {
				options = options._origOptions;
			}
					
			var promise = new Promise(function (resolve, reject) {

				that.leave(options).then(function () {

					that.enter(options).then(function () {
						resolve(options.view);

					}).catch(function (err) {
						// enter rejeced
						utils.populateError(err, severity.ERROR, options);
						reject(err);
					});

				}).catch(function (err) {
					// render Ractive rejeced
					utils.populateError(err, severity.ERROR, options);
					reject(err);

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
					target: options.target,
					_origOptions: options,
					next: {
						ctrl: options.ctrl,
						view: options.view,
						route: options.route,
					}
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
						var err = new Error("Request overwritten by another view request");
						utils.populateError(err, severity.WARN, options);
						reject(err);
						return;
					}

					resolve();


				}).catch(function (err) {
					utils.populateError(err, severity.ERROR, options);
					reject(err);
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
					target: options.target,
					_origOptions: options,
					prev: {
						ctrl: currentMVC.ctrl,
						view: currentMVC.view,
						route: currentMVC.route
					}
				};

				var enterFn = options.route.enter;
				var enterCleanupFn = that.renderViewCleanup;

				// If enter not defined, fallback to that.enter
				if (enterFn == null) {
					enterFn = that.enter;

					//Since we rederView we don't need to perform renderCleanup, so we stub it out
					enterCleanupFn = function () {};

					enterOptions = options; // set leaveOptions to options, since we are going to use that.enter instead
				}

				var enterPromise = enterFn(enterOptions);
				if (enterPromise == null) {
					enterPromise = utils.noopPromise();
				}

				enterPromise.then(function () {

					enterCleanupFn(options);
					resolve(options.view);

				}).catch(function (err) {
					utils.populateError(err, severity.ERROR, options);
					reject(err);
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

					}).catch(function (err) {
						utils.populateError(err, severity.ERROR, options);
						reject(err);
					});

				}).catch(function (err) {
					utils.populateError(err, severity.ERROR, options);
					reject(err);
				});
			});

			return promise;
		};

		that.createView = function (options) {
			// In case this method is called from a customized user option eg route.leave we check if _origOptions was set and use that instead of options
			if ( options._origOptions ) {
				options = options._origOptions;
			}

			var promise = initOptions.viewFactory.createView(options);
			return promise;
		};

		that.renderView = function (options) {
			// In case this method is called from a customized user option eg route.leave we check if _origOptions was set and use that instead of options
			if ( options._origOptions ) {
				options = options._origOptions;
			}

			var promise = new Promise(function (resolve, reject) {

				//options.view.transitionsEnabled = false;

				var renderPromise = initOptions.viewFactory.renderView(options);

				that.renderViewCleanup(options);

				renderPromise.then(function () {

					resolve(options.view);

				}).catch(function (err) {
					utils.populateError(err, severity.ERROR, options);
					reject(err);
				});
			});

			return promise;
		};

		that.renderViewCleanup = function (options) {
			// Users can provide their own route.enter function, which if provided, Kudu will automatically invoke renderViewCleanup.
			// However users can provide their own route.enter and "delegate" to kudu.enter, which will cause renderViewCleanup to be
			// called twice. Here we add a flag to guard against this
			if (options._renderViewCleanupCalled) {
				return;
			}
			options._renderViewCleanupCalled = true;

			// Store new controller and view on currentMVC
			that.updateMVC(options);

			that.callViewEvent("onRender", options);
			that.triggerEvent("render", options);
		};

		that.unrenderView = function (options) {
			// In case this method is called from a customized user option eg route.leave we check if _origOptions was set and use that instead of options
			if ( options._origOptions ) {
				options = options._origOptions;
			}
					
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
							var err = new Error("Request overwritten by another view request");
							utils.populateError(err, severity.WARN, options);
							reject(err);
							return;
						}

						resolve(options.mvc.view);


					}).catch(function (err) {
						utils.populateError(err, severity.ERROR, options);
						reject(err);
					});
				}
			});

			return promise;
		};

		that.unrenderViewCleanup = function (options) {
			// Users can provide their own route.leave function, which if provided, Kudu will automatically invoke unrenderViewCleanup.
			// However users can provide their own route.leave and "delegate" to kudu.leave, which will cause unrenderViewCleanup to be
			// called twice. Here we add a flag to guard against this
			if (options._unrenderViewCleanupCalled) {
				return;
			}
			options._unrenderViewCleanupCalled = true;

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

		function viewFailed(options, err) {
			/*
			var errors = errorArray;
			if (!Array.isArray(errorArray)) {
				errors = Array.prototype.slice.call(errorArray);
			}*/
			options.error = err;
			that.triggerEvent("fail", options);
			utils.logError(err);
			//console.error(err)

			//if (initOptions.debug) {
				
				
				/*
			}
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
				}*/
			//}
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
			if (!obj._kudu_id) {
				Object.defineProperty(obj, "_kudu_id", {
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
