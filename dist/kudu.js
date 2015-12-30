/*! Native Promise Only
    v0.8.1 (c) Kyle Simpson
    MIT License: http://getify.mit-license.org
*/

(function UMD(name,context,definition){
	// special form of UMD for polyfilling across evironments
	context[name] = context[name] || definition();
	if (typeof module != "undefined" && module.exports) { module.exports = context[name]; }
	else if (typeof define == "function" && define.amd) { define('utils/jqr/npo',[],function $AMD$(){ return context[name]; }); }
})("Promise",typeof global != "undefined" ? global : this,function DEF(){
	/*jshint validthis:true */
	"use strict";

	var builtInProp, cycle, scheduling_queue,
		ToString = Object.prototype.toString,
		timer = (typeof setImmediate != "undefined") ?
			function timer(fn) { return setImmediate(fn); } :
			setTimeout
	;

	// dammit, IE8.
	try {
		Object.defineProperty({},"x",{});
		builtInProp = function builtInProp(obj,name,val,config) {
			return Object.defineProperty(obj,name,{
				value: val,
				writable: true,
				configurable: config !== false
			});
		};
	}
	catch (err) {
		builtInProp = function builtInProp(obj,name,val) {
			obj[name] = val;
			return obj;
		};
	}

	// Note: using a queue instead of array for efficiency
	scheduling_queue = (function Queue() {
		var first, last, item;

		function Item(fn,self) {
			this.fn = fn;
			this.self = self;
			this.next = void 0;
		}

		return {
			add: function add(fn,self) {
				item = new Item(fn,self);
				if (last) {
					last.next = item;
				}
				else {
					first = item;
				}
				last = item;
				item = void 0;
			},
			drain: function drain() {
				var f = first;
				first = last = cycle = void 0;

				while (f) {
					f.fn.call(f.self);
					f = f.next;
				}
			}
		};
	})();

	function schedule(fn,self) {
		scheduling_queue.add(fn,self);
		if (!cycle) {
			cycle = timer(scheduling_queue.drain);
		}
	}

	// promise duck typing
	function isThenable(o) {
		var _then, o_type = typeof o;

		if (o != null &&
			(
				o_type == "object" || o_type == "function"
			)
		) {
			_then = o.then;
		}
		return typeof _then == "function" ? _then : false;
	}

	function notify() {
		for (var i=0; i<this.chain.length; i++) {
			notifyIsolated(
				this,
				(this.state === 1) ? this.chain[i].success : this.chain[i].failure,
				this.chain[i]
			);
		}
		this.chain.length = 0;
	}

	// NOTE: This is a separate function to isolate
	// the `try..catch` so that other code can be
	// optimized better
	function notifyIsolated(self,cb,chain) {
		var ret, _then;
		try {
			if (cb === false) {
				chain.reject(self.msg);
			}
			else {
				if (cb === true) {
					ret = self.msg;
				}
				else {
					ret = cb.call(void 0,self.msg);
				}

				if (ret === chain.promise) {
					chain.reject(TypeError("Promise-chain cycle"));
				}
				else if (_then = isThenable(ret)) {
					_then.call(ret,chain.resolve,chain.reject);
				}
				else {
					chain.resolve(ret);
				}
			}
		}
		catch (err) {
			chain.reject(err);
		}
	}

	function resolve(msg) {
		var _then, self = this;

		// already triggered?
		if (self.triggered) { return; }

		self.triggered = true;

		// unwrap
		if (self.def) {
			self = self.def;
		}

		try {
			if (_then = isThenable(msg)) {
				schedule(function(){
					var def_wrapper = new MakeDefWrapper(self);
					try {
						_then.call(msg,
							function $resolve$(){ resolve.apply(def_wrapper,arguments); },
							function $reject$(){ reject.apply(def_wrapper,arguments); }
						);
					}
					catch (err) {
						reject.call(def_wrapper,err);
					}
				})
			}
			else {
				self.msg = msg;
				self.state = 1;
				if (self.chain.length > 0) {
					schedule(notify,self);
				}
			}
		}
		catch (err) {
			reject.call(new MakeDefWrapper(self),err);
		}
	}

	function reject(msg) {
		var self = this;

		// already triggered?
		if (self.triggered) { return; }

		self.triggered = true;

		// unwrap
		if (self.def) {
			self = self.def;
		}

		self.msg = msg;
		self.state = 2;
		if (self.chain.length > 0) {
			schedule(notify,self);
		}
	}

	function iteratePromises(Constructor,arr,resolver,rejecter) {
		for (var idx=0; idx<arr.length; idx++) {
			(function IIFE(idx){
				Constructor.resolve(arr[idx])
				.then(
					function $resolver$(msg){
						resolver(idx,msg);
					},
					rejecter
				);
			})(idx);
		}
	}

	function MakeDefWrapper(self) {
		this.def = self;
		this.triggered = false;
	}

	function MakeDef(self) {
		this.promise = self;
		this.state = 0;
		this.triggered = false;
		this.chain = [];
		this.msg = void 0;
	}

	function Promise(executor) {
		if (typeof executor != "function") {
			throw TypeError("Not a function");
		}

		if (this.__NPO__ !== 0) {
			throw TypeError("Not a promise");
		}

		// instance shadowing the inherited "brand"
		// to signal an already "initialized" promise
		this.__NPO__ = 1;

		var def = new MakeDef(this);

		this["then"] = function then(success,failure) {
			var o = {
				success: typeof success == "function" ? success : true,
				failure: typeof failure == "function" ? failure : false
			};
			// Note: `then(..)` itself can be borrowed to be used against
			// a different promise constructor for making the chained promise,
			// by substituting a different `this` binding.
			o.promise = new this.constructor(function extractChain(resolve,reject) {
				if (typeof resolve != "function" || typeof reject != "function") {
					throw TypeError("Not a function");
				}

				o.resolve = resolve;
				o.reject = reject;
			});
			def.chain.push(o);

			if (def.state !== 0) {
				schedule(notify,def);
			}

			return o.promise;
		};
		this["catch"] = function $catch$(failure) {
			return this.then(void 0,failure);
		};

		try {
			executor.call(
				void 0,
				function publicResolve(msg){
					resolve.call(def,msg);
				},
				function publicReject(msg) {
					reject.call(def,msg);
				}
			);
		}
		catch (err) {
			reject.call(def,err);
		}
	}

	var PromisePrototype = builtInProp({},"constructor",Promise,
		/*configurable=*/false
	);

	// Note: Android 4 cannot use `Object.defineProperty(..)` here
	Promise.prototype = PromisePrototype;

	// built-in "brand" to signal an "uninitialized" promise
	builtInProp(PromisePrototype,"__NPO__",0,
		/*configurable=*/false
	);

	builtInProp(Promise,"resolve",function Promise$resolve(msg) {
		var Constructor = this;

		// spec mandated checks
		// note: best "isPromise" check that's practical for now
		if (msg && typeof msg == "object" && msg.__NPO__ === 1) {
			return msg;
		}

		return new Constructor(function executor(resolve,reject){
			if (typeof resolve != "function" || typeof reject != "function") {
				throw TypeError("Not a function");
			}

			resolve(msg);
		});
	});

	builtInProp(Promise,"reject",function Promise$reject(msg) {
		return new this(function executor(resolve,reject){
			if (typeof resolve != "function" || typeof reject != "function") {
				throw TypeError("Not a function");
			}

			reject(msg);
		});
	});

	builtInProp(Promise,"all",function Promise$all(arr) {
		var Constructor = this;

		// spec mandated checks
		if (ToString.call(arr) != "[object Array]") {
			return Constructor.reject(TypeError("Not an array"));
		}
		if (arr.length === 0) {
			return Constructor.resolve([]);
		}

		return new Constructor(function executor(resolve,reject){
			if (typeof resolve != "function" || typeof reject != "function") {
				throw TypeError("Not a function");
			}

			var len = arr.length, msgs = Array(len), count = 0;

			iteratePromises(Constructor,arr,function resolver(idx,msg) {
				msgs[idx] = msg;
				if (++count === len) {
					resolve(msgs);
				}
			},reject);
		});
	});

	builtInProp(Promise,"race",function Promise$race(arr) {
		var Constructor = this;

		// spec mandated checks
		if (ToString.call(arr) != "[object Array]") {
			return Constructor.reject(TypeError("Not an array"));
		}

		return new Constructor(function executor(resolve,reject){
			if (typeof resolve != "function" || typeof reject != "function") {
				throw TypeError("Not a function");
			}

			iteratePromises(Constructor,arr,function resolver(idx,msg){
				resolve(msg);
			},reject);
		});
	});

	return Promise;
});

define('utils/utils',['require','./jqr/npo'],function (require) {

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
define('utils/jqr/jqutils',['require','./npo'],function (require) {

	require("./npo");

	function utils(options) {

		var that = {};

		var rbracket = /\[\]$/;
		var r20 = /%20/g;
		
		that.isFunction = function (val) {
			return typeof val === 'function';
		};

		that.fadeIn = function (el) {
			el.style.opacity = 0;

			var last = +new Date();
			var tick = function () {
				el.style.opacity = +el.style.opacity + (new Date() - last) / 400;
				last = +new Date();

				if (+el.style.opacity < 1) {
					(window.requestAnimationFrame && requestAnimationFrame(tick)) || setTimeout(tick, 16)
				}
			};

			tick();
		};

		that.fadeOut = function (el) {
			el.style.opacity = 0;

			var last = +new Date();
			var tick = function () {
				el.style.opacity = +el.style.opacity + (new Date() - last) / 400;
				last = +new Date();

				if (+el.style.opacity < 1) {
					(window.requestAnimationFrame && requestAnimationFrame(tick)) || setTimeout(tick, 16)
				}
			};

			tick();
		};

		that.extend = function (out) {
			out = out || {};

			for (var i = 1; i < arguments.length; i++) {
				if (!arguments[i])
					continue;

				for (var key in arguments[i]) {
					if (arguments[i].hasOwnProperty(key))
						out[key] = arguments[i][key];
				}
			}

			return out;
		};
		
		function type(obj) {
			return Object.prototype.toString.call(obj).replace(/^\[object (.+)\]$/, "$1").toLowerCase();
		}


		function buildParams(prefix, obj, traditional, add) {
			var name;

			if (Array.isArray(obj)) {
				// Serialize array item.
				obj.forEach(function (item, index) {
					if (traditional || rbracket.test(prefix)) {
						// Treat each array item as a scalar.
						add(prefix, item);

					} else {
						// Item is non-scalar (array or object), encode its numeric index.
						buildParams(prefix + "[" + (typeof item === "object" ? index : "") + "]", item, traditional, add);
					}
				});

			} else if (!traditional && type(obj) === "object") {
				debugger;
				// Serialize object item.
				for (name in obj) {
					buildParams(prefix + "[" + name + "]", obj[ name ], traditional, add);
				}

			} else {
				// Serialize scalar item.
				add(prefix, obj);
			}
		}

		// Serialize an array of form elements or a set of key/values into a query string
		that.param = function (a, traditional) {
			var prefix,
					s = [],
					add = function (key, value) {
						// If value is a function, invoke it and return its value
						value = (typeof value === 'function') ? value() : (value == null ? "" : value);
						s[ s.length ] = encodeURIComponent(key) + "=" + encodeURIComponent(value);
					};


			// If an array was passed in, assume that it is an array of form elements.
			if (Array.isArray(a)) {
				// Serialize the form elements
				a.forEach(function (item, index) {
					add(item.name, item.value);
				});

			} else {
				// If traditional, encode the "old" way (the way 1.3.2 or older
				// did it), otherwise encode params recursively.
				for (prefix in a) {
					buildParams(prefix, a[ prefix ], traditional, add);
				}
			}

			// Return the resulting serialization
			return s.join("&").replace(r20, "+");
		};


		return that;
	}

	var utils = utils();
	return utils;

});
// https://github.com/erikringsmuth/requirejs-router#
// 
// RequireJS Router - A scalable, lazy loading, AMD router.
//
// Version: 0.8.0
// 
// The MIT License (MIT)
// Copyright (c) 2014 Erik Ringsmuth
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
// IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE
// OR OTHER DEALINGS IN THE SOFTWARE.

define('router/router',['require','../utils/jqr/npo','../utils/utils','../utils/jqr/jqutils'],function (require) {
	'use strict';

	require("../utils/jqr/npo");
	var utils = require("../utils/utils");
	var jqutils = require("../utils/jqr/jqutils");

	// Private closure variables
	var cachedUrlPaths = {};
	var cachedRouterParams = {};
	var cachedRouterQueryParams = {};
	var eventHandlers = {
		statechange: [],
		routeload: []
	};

	// routes - All registered routes
	var routes = [];

	var routesById = {};

	var unknownRouteResolver;

	var defaultRoute;

	var unknownRoute;

	var noop = function () {
	};

	var ignoreHashChangeOnce = false;

	var currentHash;

	// In some modern browsers a hashchange also fires a popstate. There isn't a check to see if the browser will fire
	// one or both. We have to keep track of the previous state to prevent it from fireing a statechange twice.
	var previousState = '';
	var popstateHashchangeEventLisener = function popstateHashchangeEventLisener() {
		if (previousState != window.location.href) {
			previousState = window.location.href;

			// Guard against statechange firing after browser refresh
			if (router.getHash() === currentHash) {
				return;
			}

			currentHash = router.getHash();
			router.fire('statechange');
		}
	};

	// router public interface
	//
	// There is only one instance of the router. Loading it in multiple modules will always load the same router.
	var router = {
		// router.init([options]) - initializes the router
		init: function (options) {
			currentHash = router.getHash();
			if (typeof (options) === 'undefined') {
				options = {};
			}
			router.addRoutes(options.routes);
			unknownRouteResolver = options.unknownRouteResolver || resolveUnknownRoutes;
			defaultRoute = options.defaultRoute || null;

			// Set up the window popstate and hashchange event listeners
			if (window.addEventListener) {
				window.addEventListener('popstate', popstateHashchangeEventLisener, false);
				window.addEventListener('hashchange', popstateHashchangeEventLisener, false);
			} else {
				// IE 8 and lower
				window.attachEvent('popstate', popstateHashchangeEventLisener); // In case pushState has been polyfilled
				window.attachEvent('onhashchange', popstateHashchangeEventLisener);
			}

			// Call loadCurrentRoute on every statechange event
			if (options.loadCurrentRouteOnStateChange !== false) {
				router.on('statechange', function () {

					if (ignoreHashChangeOnce) {
						// Ensure future hashchange events are not ignored
						ignoreHashChangeOnce = false;
						return;
					}

					var options = {};
					router.loadCurrentRoute(options);
				});
			}

			// Fire the initial statechange event
			if (options.fireInitialStateChange !== false) {
				router.fire('statechange');
			}

			return router;
		},
		//routes: {},
		// router.activeRoute - A reference to the active route
		activeRoute: {},
		// router.addRoutes(routes) - Register routes
		//
		// This will add the routes to the existing routes. Specifying a route with the same name as an existing route will
		// overwrite the previous route with the new one.
		//
		// Example
		// router.addRoutes({
		//   home: {path: '/', moduleId: 'home/homeView'},
		//   customer: {path: '/customer/:id', moduleId: 'customer/customerView'},
		//   notFound: {path: '*', moduleId: 'notFound/notFoundView'}
		// })
		addRoutes: function (routes) {
			for (var key in routes) {
				if (routes.hasOwnProperty(key)) {
					router.addRoute(routes[key]);
				}
			}
			return router;
		},
		addRoute: function (route) {
			routes.push(route);

			if (route.moduleId == null) {
				if (route.ctrl == null) {
					throw new Error("route must have a ctrl or moduleId defined!");
				}

				route.moduleId = route.ctrl.id;
			}
			router.addRouteById(route);
			return router;
		},
		addRouteAt: function (index, route) {
			routes.splice(index, 0, route);
			router.addRouteById(route);
			return router;
		},
		addRouteById: function (route) {

			if (route.path === '*') {
				unknownRoute = route;
			}

			// Multiple paths can be mapped to same route, so we use array
			if (routesById[route.moduleId] === undefined) {
				routesById[route.moduleId] = [];
			}

			routesById[route.moduleId].push(route.path);
		},
		getRoutes: function () {
			return routes;
		},
		getRoutesById: function () {
			return routesById;
		},
		// router.on(eventName, eventHandler([arg1, [arg2]]) {}) - Register an event handler
		//
		// The two main events are 'statechange' and 'routeload'.
		on: function on(eventName, eventHandler) {
			if (typeof (eventHandlers[eventName]) === 'undefined')
				eventHandlers[eventName] = [];
			eventHandlers[eventName].push(eventHandler);
			return router;
		},
		// router.fire(eventName, [arg1, [arg2]]) - Fire an event
		//
		// This will call all eventName event handlers with the arguments passed in.
		fire: function fire(eventName) {
			if (eventHandlers[eventName]) {
				var eventArguments = Array.prototype.slice.call(arguments, 1);
				for (var i = 0; i < eventHandlers[eventName].length; i++) {
					eventHandlers[eventName][i].apply(router, eventArguments);
				}
			}
			return router;
		},
		// router.off(eventName, eventHandler) - Remove an event handler
		//
		// If you want remove an event handler you need to keep a reference to it so you can tell router.off() with the
		// original event handler.
		off: function off(eventName, eventHandler) {
			if (eventHandlers[eventName]) {
				var eventHandlerIndex = eventHandlers[eventName].indexOf(eventHandler);
				if (eventHandlerIndex !== -1) {
					eventHandlers[eventName].splice(eventHandlerIndex, 1);
				}
			}
			return router;
		},
		go: function (options) {

			var ctrl = options.ctrl;
			var moduleId;

			if (ctrl == null) {
				if (options.route) {
					ctrl = options.route.ctrl;
					moduleId = options.route.moduleId;
				}
			}

			if (ctrl == null) {
				throw new Error("router.go() requires a 'ctrl' passed as an option !");
			}

			if (moduleId == null) {
				moduleId = ctrl.id;
			}

			options.args = options.args || {};
			options.routeParams = options.routeParams || {};

			if (options.updateUrl === false) {
				var tempRoute = {};
				tempRoute.moduleId = moduleId;
				tempRoute.ctrl = ctrl;
				options.route = tempRoute;

				var tmpHash = router.hashPath(currentHash);
				tmpHash = appendHashParams(tmpHash, options.routeParams);
				setIgnoreHashChangeOnce(tmpHash);
				router.setHash(tmpHash);
				router.loadModule(options);
				return;
			}

			var route = null;

			//var currentPath = router.urlPath(window.location.href);
			var ctrlRoutes = router.findRoutesForCtrl(ctrl);
			for (var i = 0; i < ctrlRoutes.length; i++) {
				var testRoute = ctrlRoutes[i];
				var match = router.testCtrlRoute(testRoute.path, options.routeParams);
				if (match) {
					route = testRoute;
					break;
				}
			}

			if (route == null) {
				console.error("No route matched request to Controller '" + ctrl.id + "'! Available routes for this controller: ");
				for (var i = 0; i < ctrlRoutes.length; i++) {
					var debugRoute = ctrlRoutes[i];
					console.error("    ", debugRoute.path);
				}
				console.error("RouteParams used to match available Controller routes:", options.routeParams);

				if (options.force) {
					console.error("options.force is true: will attempt to load the controller from moduleId: '" + moduleId + "'");

				} else {
					options.route = unknownRoute;
					if (options.route == null) {
						options.route = {};
					}
					router.loadModule(options);
					return;

				}
			}

			// Set routePath, if route is null use moduleId
			var routePath = route != null ? route.path : moduleId;
			//routePath = stripLeadingSlash(routePath);


			// TODO instead of throwing error for unsupported paths, we could remove the hash from the url and still render the Controller
			if (routePath instanceof RegExp) {
				throw new Error("Cannot route to controller '" + ctrl.id + "' since it's route path is a RegExp '" + routePath + "'");
			}

			if (routePath.indexOf('*') !== -1) {
				throw new Error("Cannot route to controller '" + ctrl.id + "' since it's route path contains wildcards '*'. The given route for the controller is '" + routePath + "'");
			}

			var routeQueryParams = {};

			// Extract query params from route
			if (routePath.indexOf('?') !== -1) {
				var routeQueryParamsStr = router.queryString(routePath);
				if (routeQueryParamsStr.length > 0) {
					routeQueryParams = router.parseRouteQueryParams(routeQueryParamsStr);
				}
				// TODO we must build up the route dynamically. Next parse the path segments!
				routePath = routePath.substr(0, routePath.indexOf('?'));
			}

			var newHash = '';
			var routeParams = options.routeParams;

			//propertyTypeEdit/:name?id&ok
			var routePathSegments = routePath.split('/');

			// Check and append each path segment
			for (var key in routePathSegments) {
				if (routePathSegments.hasOwnProperty(key)) {
					var routePathSegment = routePathSegments[key];

					// Check if routePathSegment is a parameter like ':id'
					if (routePathSegment.charAt(0) === ':') {
						var routePathKey = routePathSegment.substr(1);

						// Ensure the url has a valid value for the matching segment
						// Ensure value is not null or empty
						var routeParamValue = routeParams[routePathKey];

						if (routeParamValue == null || routeParamValue === '') {
							throw new Error("Cannot route to controller '" + ctrl.id + "' since it's route requires the path parameter '"
									+ routePathKey + "' but the only params provided are '" + JSON.stringify(routeParams) + "'");
						}

						newHash = appendUrlSegment(newHash, routeParamValue);

						// We have added the routeParam value. Delete the route parameter so it is not included in the query parameters below
						delete routeParams[routePathKey];

						// continue and check the other segments

					} else {
						// This is a normal path segment, so append to newHash
						newHash = appendUrlSegment(newHash, routePathSegment);
					}
				}
			}

			// strip leading '/' if present
			/* if (newHash.indexOf('/') === 0) {
			 newHash = newHash.substr(1);
			 }*/

			// add parameters to newHash

			// Check that the expected route query params are present in the passed in route params
			for (var routeParamKey in routeQueryParams) {
				if (routeQueryParams.hasOwnProperty(routeParamKey)) {
					if (routeParams == null) {
						// The route specifies a query param but no routeParams was provided
						throw new Error("Cannot route to controller '" + ctrl.id + "' since it's route requires the query parameter '"
								+ routeParamKey + "' but no routeParams was provided");
					} else {
						var routeParamValue = routeParams[routeParamKey];
						if (routeParamValue === undefined) {
							// TODO test this scenario
							throw new Error("Cannot route to controller '" + ctrl.id + "' since it's route requires the query parameter '"
									+ routeParamKey + "' but the only routeParams provided are '" + JSON.stringify(routeParams) + "'");
						}
					}
				}
			}

			newHash = appendHashParams(newHash, routeParams);

			setIgnoreHashChangeOnce(newHash);

			router.setHash(newHash);
			//router.fire('routeload', options);
			router.loadCurrentRoute(options);
			//}
		},
		setHash: function (hash) {
			window.location.hash = hash;
			//currentHash = router.getHash(); TODO this line might be required
		},
		getHash: function () {
			// This method might be overkill if we support only IE9 and up
			var index = window.location.href.indexOf('#');
			var hash = (index == -1 ? '' : window.location.href.substr(index + 1));
			if (hash.indexOf('!') == 0) {
				hash = hash.substr(1);
			}
			return hash;
		},
		findRoutesForCtrl: function (module) {
			var result = [];
			var moduleId = module.id;
			for (var i = 0; i < routes.length; i++) {

				var route = routes[i];
				if (moduleId == null || route.moduleId == null) {
					if (module === route.ctrl) {
						result.push(route);
					}

				} else {
					if (moduleId === route.moduleId) {
						result.push(route);
					}

				}
			}
			return result;
		},
		testCtrlRoute: function (routePath, viewParams) {
			routePath = stripLeadingSlash(routePath);

			var routeParams = router.parseRouteParams(routePath);

			for (var key in routeParams) {
				if (routeParams.hasOwnProperty(key)) {

					if (viewParams.hasOwnProperty(key)) {
						// The routeParam has a coresponding view parameter
						// Ensure the view parameter has a value if it is a segment parameter
						var routeParamValue = routeParams[key];
						if (routeParamValue.segment === true) {
							var viewParamValue = viewParams[key];
							if (viewParamValue == null || viewParamValue == '') {
								return false;
							}
						}

					} else {
						// If any of the routeParams is missing from the viewParams, it is not a match
						return false;

					}
				}
			}
			// If we get here all route parameters are present in view parameters and segment parameters have a value
			return true;
		},
		// router.loadCurrentRoute() - Manually tell the router to load the module for the current route
		loadCurrentRoute: function (options) {
			options = options || {};

			var routeToLoad = null;
			for (var i = 0; i < routes.length; i++) {
				//for (var i in routes) {
				//if (routes.hasOwnProperty(i)) {
				var route = routes[i];

				options.route = route;
				// TODO: Should speed up lookup of routes to a map?
				if (router.testRoute(options)) {
					// This is the first route to match the current URL
					routeToLoad = route;
					break;
				}
				//}
			}

			if (routeToLoad == null || routeToLoad.path === '*') {
				// No route found for url, check if new route should be created
				options.route = routeToLoad;
				router.handleUnknownRoute(options);
				return router;
			}

			if (routeToLoad != null) {
				options.route = routeToLoad;
				router.loadModule(options);
			}

			return router;
		},
		handleUnknownRoute: function (options) {

			var routeOrPromise = unknownRouteResolver(options.route);

			if (utils.isPromise(routeOrPromise)) {

				routeOrPromise.then(function (newRoute) {

					options.route = newRoute;
					router.loadUnknownRoute(options);

				}).catch(function () {
					// Rejected. try and load the route that was found previously which is probably the '*' mapping.
					if (options.route != null) {
						router.loadModule(options);
					}
				});
			} else {
				options.route = routeOrPromise;
				router.loadUnknownRoute(options);
			}
			return router;
		},
		loadUnknownRoute: function (options) {
			options = options || {};
			if (options.route != null) {
				if (options.route.moduleId == null || options.route.path == null) {
					throw new Error("unknownRouteResolver must return a route object with a valid moduleId and path or a promise that resolves to a route object!");
				}

				// Only add unknown route if it isn't already registered. This can occur if resolveUnknownRoute() returns a known
				// route or a defaultRoute
				var paths = router.getRoutesById()[options.route.moduleId];
				if (paths == null) {
					options.route.isNew = true;
					router.loadModule(options);
				} else {
					router.go(options);
				}

			}
			return router;
		},
		loadModule: function (options) {
			options = options || {};
			// Replace router.activeRoute with this route
			var route = options.route;

			// Load the route's module

			if (route.ctrl == null) {

				require([route.moduleId], function (module) {
					if (module == null) {
						return;
					}

					router.processLoadedModule(options, module, route);

				}, function () {
					//console.error(arguments);
				});

			} else {
				router.processLoadedModule(options, route.ctrl, route);


			}

		},
		// urlPath(url) - Parses the url to get the path
		//
		// This will return the hash path if it exists or return the real path if no hash path exists.
		//
		// Example URL = 'http://domain.com/other/path?queryParam3=false#/example/path?queryParam1=true&queryParam2=example%20string'
		// path = '/example/path'
		//
		// Note: The URL must contain the protocol like 'http(s)://'
		urlPath: function (url) {
			// Check the cache to see if we've already parsed this URL
			if (typeof (cachedUrlPaths[url]) !== 'undefined') {
				return cachedUrlPaths[url];
			}

			// The relative URI is everything after the third slash including the third slash
			// Example relativeUri = '/other/path?queryParam3=false#/example/path?queryParam1=true&queryParam2=example%20string'
			var splitUrl = url.split('/');
			var relativeUri = '/' + splitUrl.splice(3, splitUrl.length - 3).join('/');

			// The path is everything in the relative URI up to the first ? or #
			// Example path = '/other/path'
			var path = relativeUri.split(/[\?#]/)[0];

			// The hash is everything from the first # up to the the search starting with ? if it exists
			// Example hash = '#/example/path'
			var hashIndex = relativeUri.indexOf('#');
			var isHashEmpty = hashIndex === relativeUri.length - 1;

			if (hashIndex !== -1 && !isHashEmpty) {
				var hash = relativeUri.substring(hashIndex).split('?')[0];
				if (hash.substring(0, 2) === '#!') {
					// Hashbang path
					path = hash.substring(2);
				} else {
					// Hash path
					path = hash.substring(1);
				}
			}

			// Cache the path for this URL
			cachedUrlPaths[url] = path;

			return path;
		},
		processLoadedModule: function (options, module, route) {
			router.activeRoute.active = false;
			route.active = true;
			router.activeRoute = route;

			// Register newly discovered routes
			if (route.isNew) {
				delete route.isNew;
				router.addRouteAt(0, route);
			}
			// Make sure this is still the active route from when loadCurrentRoute was called. The asynchronous nature
			// of AMD loaders means we could have fireed multiple hashchanges or popstates before the AMD module finished
			// loading. If we navigate to route /a then navigate to route /b but /b finishes loading before /a we don't
			// want /a to be rendered since we're actually at route /b.
			if (route.active) {

				// Check if routeParams has been cached for this request, otherwise cache it for this request in the options
				var urlParams = options.urlParams;
				if (urlParams == null) {
					urlParams = router.routeArguments(route, window.location.href);
					options.urlParams = urlParams;
				}

				var routerOptions = jqutils.extend({}, options);
				routerOptions.routeParams = urlParams;
				routerOptions.module = module;
				routerOptions.route = route;

				router.fire('routeload', routerOptions);
			}
		},
		// router.testRoute(route, [url]) - Test if the route matches the current URL
		//
		// This algorithm tries to fail or succeed as quickly as possible for the most common cases.
		testRoute: function (options) {

			// Example path = '/example/path'
			// Example route: `exampleRoute: {path: '/example/*', moduleId: 'example/exampleView'}`
			var urlPath = router.urlPath(options.url || window.location.href);
			urlPath = stripLeadingSlash(urlPath);

			var routePath = options.route.path;
			routePath = stripLeadingSlash(routePath);

			// If the path is an exact match then the route is a match
			if (routePath === urlPath) {
				return true;
			}

			// If the path is '*' then the route is a match
			if (routePath === '*') {
				return true;
			}

			// Test if it's a regular expression
			if (routePath instanceof RegExp) {
				return routePath.test(urlPath);
			}

			// Look for wildcards
			if (routePath.indexOf('*') === -1 && routePath.indexOf(':') === -1 && routePath.indexOf('?') === -1) {
				// No wildcards or parameters and we already made sure it wasn't an exact match so the test fails
				return false;
			}

			// Example pathSegments = ['', example', 'path']
			var urlPathSegments = urlPath.split('/');

			// Chop off any query parameters (everything after and including ?) from the routePath
			var routePathQuestionIndex = routePath.indexOf('?');
			// Check if there is a ? but that the ? is not the last character
			if (routePathQuestionIndex !== -1 && routePathQuestionIndex !== routePath.length - 1) {
				routePath = routePath.substr(0, routePathQuestionIndex);
			}

			// Example routePathSegments = ['', 'example', '*']
			var routePathSegments = routePath.split('/');

			// There must be the same number of path segments or it isn't a match
			if (urlPathSegments.length !== routePathSegments.length) {
				return false;
			}

			// Check equality of each path segment
			for (var key in routePathSegments) {
				if (routePathSegments.hasOwnProperty(key)) {
					// The path segments must be equal, be a wildcard segment '*', or be a path parameter like ':id'
					var routePathSegment = routePathSegments[key];
					var urlPathSegment = urlPathSegments[key];

					// Check if routePathSegment is the same string as the urlPathSegment or the routePathSegment is a wildcard or parameter
					if (routePathSegment === '*' || routePathSegment.charAt(0) === ':') {
						// This is a valid segment

						// Ensure the url has a valid value for the matching segment
						// Ensure value is not null or empty
						if (urlPathSegment == null || urlPathSegment === '') {
							return false;
						}

						// continue and check the other segments

					} else {
						if (routePathSegment !== urlPathSegment) {
							// Not a valid segment so the url does not match the route
							return false;
						}
					}
				}
			}

			// If we get here the url path segments matches the route path segments. Next we check the query parameters, if there are any
			if (routePathQuestionIndex !== -1) {
				var tmpRoutePath = options.route.path;
				tmpRoutePath = stripLeadingSlash(tmpRoutePath);
				var routeQueryParamsStr = tmpRoutePath.substr(routePathQuestionIndex + 1);

				var routeParams = router.parseRouteQueryParams(routeQueryParamsStr);

				// The url path segments match but the route also specifies query params we need to check

				// Extract params from url
				if (options.urlParams == null) {
					var tempParams = router.routeArguments(options.route, window.location.href);
					options.urlParams = tempParams;
				}

				for (var key in routeParams) {
					if (routeParams.hasOwnProperty(key)) {
						var urlParamValue = options.urlParams[key];

						if (urlParamValue == null) {
							// There is no parameter in the url for the routeParameter so we do not have a match
							return false;
						}
					}
				}
			}

			// Nothing failed. The route matches the URL.
			return true;
		},
		// router.routeArguments([route, [url]]) - Gets the path variables and query parameter values from the URL
		//
		// Both parameters are optional.
		routeArguments: function (route, url) {

			/*
			 var cacheResult = getCachedRouteArguments(route, url);
			 if (cacheResult != null) {
			 
			 return cacheResult;
			 }*/

			//argumentsCache[];
			if (!route)
				route = router.activeRoute;
			if (!url)
				url = window.location.href;
			var args = {};
			var urlPath = router.urlPath(url);
			urlPath = stripLeadingSlash(urlPath);

			// Example pathSegments = ['', example', 'path']
			var urlPathSegments = urlPath.split('/');

			// Example routePathSegments = ['', 'example', '*']
			var routePathSegments = [];
			if (route && route.path && !(route.path instanceof RegExp)) {
				var routePath = route.path;
				routePath = stripLeadingSlash(routePath);
				routePathSegments = routePath.split('/');
			}

			// Get path variables
			// URL '/customer/123'
			// and route `{path: '/customer/:id'}`
			// gets id = '123'
			for (var routeSegmentIndex in routePathSegments) {
				if (routePathSegments.hasOwnProperty(routeSegmentIndex)) {
					var routeSegment = routePathSegments[routeSegmentIndex];
					if (routeSegment.charAt(0) === ':') {
						routeSegment = routeSegment.substring(1);
						// Strip everything after and including ? if present
						var questionmarkIndex = routeSegment.indexOf('?');
						if (questionmarkIndex !== -1) {
							routeSegment = routeSegment.substr(0, questionmarkIndex);
						}
						args[routeSegment] = urlPathSegments[routeSegmentIndex];
					}
				}
			}

			//get query string
			var search = router.queryString(url);
			var queryParams = router.queryParamsFromSearchString(search);
			for (var param in queryParams) {
				if (queryParams.hasOwnProperty(param)) {
					args[param] = queryParams[param];
				}
			}

			// Parse the arguments into unescaped strings, numbers, or booleans
			args = router.parseArguments(args);

			//setCachedRouteArguments(route, url, args);
			return args;
		},
		queryString: function (url) {
			// Get the query string from the url
			// The query string is the query parameters excluding the leading '?'
			var searchIndex = url.indexOf('?');
			var search = '';
			if (searchIndex !== -1) {
				search = url.substring(searchIndex + 1);
				var hashIndex = search.indexOf('#');
				if (hashIndex !== -1) {
					search = search.substring(0, hashIndex);
				}
			}
			// TODO only check url once to extract params, not twice once for url and again for hash
			// If it's a hash URL we need to get the search from the hash
			var hashPathIndex = url.indexOf('#');
			var hashBangPathIndex = url.indexOf('#!');
			if (hashPathIndex !== -1 || hashBangPathIndex !== -1) {
				var hash = '';
				if (hashPathIndex !== -1) {
					hash = url.substring(hashPathIndex);
				} else {
					hash = url.substring(hashBangPathIndex);
				}
				searchIndex = hash.indexOf('?');
				if (searchIndex !== -1) {
					search = hash.substring(searchIndex + 1);
				}
			}
			return search;
		},
		queryParams: function (url) {
			var search = router.queryString(url);
			var queryParams = router.queryParamsFromSearchString(search);
			return queryParams;
		},
		queryParamsFromSearchString: function (search) {
			var params = {};
			var queryParameters = search.split('&');
			// split() on an empty string has a strange behavior of returning [''] instead of []
			if (queryParameters.length === 1 && queryParameters[0] === '') {
				queryParameters = [];
			}
			for (var i in queryParameters) {
				if (queryParameters.hasOwnProperty(i)) {
					var queryParameter = queryParameters[i];
					var queryParameterParts = queryParameter.split('=');
					var value = queryParameterParts.splice(1, queryParameterParts.length - 1).join('=');
					params[queryParameterParts[0]] = value;
				}
			}
			return params;
		},
		parseArguments: function (args) {
			for (var arg in args) {
				var value = args[arg];
				if (value === 'true') {
					args[arg] = true;
				} else if (value === 'false') {
					args[arg] = false;
				} else if (!isNaN(value) && value !== '' && value.charAt(0) !== '0') {
					// numeric
					args[arg] = +value;
				} else {
					// string
					args[arg] = decodeURIComponent(value);
				}
			}
			return args;
		},
		parseRouteQueryParams: function (routerQueryParams) {

			var hit = cachedRouterQueryParams[routerQueryParams];
			if (hit != null) {
				return hit;
			}

			var routeParams = {};
			var routeQueryParameters = routerQueryParams.split('&');
			// split() on an empty string has a strange behavior of returning [''] instead of []
			if (routeQueryParameters.length === 1 && routeQueryParameters[0] === '') {
				routeQueryParameters = [];
			}
			for (var key in routeQueryParameters) {
				if (routeQueryParameters.hasOwnProperty(key)) {
					var routeQueryParameter = routeQueryParameters[key];
					routeParams[routeQueryParameter] = {query: true};
				}
			}
			// Cache result
			cachedRouterQueryParams[routerQueryParams] = routeParams;

			return routeParams;
		},
		parseRouteParams: function (path) {
			var hit = cachedRouterParams[path];
			if (hit != null) {
				return hit;
			}

			var routePath = path;
			var routeParams = {};

			if (routePath == null || routePath == '') {
				return routeParams;
			}

			// Test if it's a regular expression
			if (routePath instanceof RegExp) {
				routePath = routePath.toString();
				// Remove slashes from beginning and end
				routePath = routePath.substring(1, routePath.length - 1);
			}


			if (routePath.indexOf(':') === -1 && routePath.indexOf('?') !== -1) {
				// No parameters in routePath
				cachedRouterParams[path] = routeParams;
				return routeParams;
			}

			// Chop off any query parameters (everything after and including ?) from the routePath
			var routePathQuestionIndex = routePath.indexOf('?');
			// Check if there is a ? but that the ? is not the last character
			if (routePathQuestionIndex !== -1 && routePathQuestionIndex !== routePath.length - 1) {
				// Remove query parms
				routePath = routePath.substr(0, routePathQuestionIndex);
			}

			// Parse segment parameters eg ':id'
			// Example routePathSegments = ['foo', 'bar', ':id', '']
			var routePathSegments = routePath.split('/');

			for (var key in routePathSegments) {
				if (routePathSegments.hasOwnProperty(key)) {
					// The path segments must be equal, be a wildcard segment '*', or be a path parameter like ':id'
					var routePathSegment = routePathSegments[key];

					// Check if routePathSegment is a segment dparameter
					if (routePathSegment.charAt(0) === ':') {
						var param = routePathSegment.slice(1);
						routeParams[param] = {segment: true};
					}
				}
			}

			// Parse query string parameters eg ?id&name
			if (routePathQuestionIndex !== -1) {
				var routeQueryParamsStr = path.substr(routePathQuestionIndex + 1);

				var routeQueryParams = router.parseRouteQueryParams(routeQueryParamsStr);
				routeParams = jqutils.extend(routeParams, routeQueryParams);
			}
			cachedRouterParams[path] = routeParams;
			return routeParams;
		},
		hashPath: function (hash) {
			// Remove leading #
			if (hash.indexOf('#') === 0) {
				hash = hash.substring(1);
			}

			// Remove everything after the ?
			var idx = hash.indexOf('?');
			if (idx >= 0) {
				hash = hash.substring(0, idx);
			}

			return hash;
		}
	};

	function resolveUnknownRoutes() {
		var promise = new Promise(function (resolve, reject) {

			var hashIndex = window.location.href.indexOf('#');

			if (hashIndex === -1 || hashIndex === location.href.length - 1) {
				// no hash found or hash is at end of url and no hash part is available, so use default view
				if (defaultRoute == null) {
					throw new Error("Couldn't resolve the url, " + location.href + ", to a route. Please set the option 'kudu.defaultRoute' to render a default page!");
				}
				resolve(defaultRoute);// TODO update hash
				return promise;
			}

			var path = router.urlPath(window.location.href);
			path = stripLeadingSlash(path);

			/*
			 if (path.indexOf("/") === 0) {
			 path = path.substr(1);
			 }*/

			require([path], function (module) {
				if (module == null) {
					reject();
					return;
				}

				var newRoute = {
					path: path,
					ctrl: module,
					moduleId: path
				};
				resolve(newRoute);

			}, function () {
				reject();

			});
		});

		return promise;
	}

	function appendHashParams(hash, params) {

		if (params != null) {
			var traditional = true;
			var paramStr = jqutils.param(params, traditional);

			if (paramStr.length > 0) {

				if (hash.indexOf('?') === -1) {
					// No existing parameters
					hash = hash + '?' + paramStr;

				} else {
					// There are existing parameters
					hash = hash + '&' + paramStr;
				}

			}
		}
		return hash;
	}

	function stripLeadingSlash(str) {
		if (typeof str === "string") {
			if (str.indexOf("/") === 0) {
				return str.slice(1);
			}
		}
		return str;
	}

	function setIgnoreHashChangeOnce(newHash) {
		if (currentHash != newHash) {
			ignoreHashChangeOnce = true;
		}
	}

	function appendUrlSegment(url, segment) {
		if (url.length > 0 && url !== '/') {
			url = url + '/';
		}
		if (segment.length == 0) {
			segment = "/";
		}
		url = url + segment;
		return url;
	}

	// Return the router
	return router;
});
define('utils/ajaxTracker',['require','./jqr/npo'],function (require) {

	require("./jqr/npo");

	function toES6Promise($promise) {
		var es6Promise = new Promise(function (resolve, reject) {

			$promise.then(function (data, textStatus, jqXHR) {
				resolve({data: data, status: textStatus, xhr: jqXHR});
			}, function (jqXHR, textStatus, errorThrown) {
				reject({error: errorThrown, status: textStatus, xhr: jqXHR});
			});

			$promise.then(resolve, reject);
		});
		es6Promise.abort = $promise.abort;
		return es6Promise;
	}

	function ajaxTracker(kudu) {

		if (kudu == null) {
			throw new Error("ajaxTracker requires a kudu instance!");
		}

		var that = {};
		var idCounter = 0;
		var promiseCounter = 0;

		var promisesMap = {};
		var globalPromise = null;
		//var globalPromiseArgs = {};

		that.add = function (target, promise, args) {

			if (typeof promise.abort !== 'function') {
				throw new Error("ajaxTracker.add(promise) requires an 'abort' function for when views are cancelled!");
			}

			if (isXhr(promise) && typeof promise.then === 'function') {
				// assume it is a jquery xhr, convert to es6 promise
				promise = toES6Promise(promise);
			}

			var promisesArray = promisesMap[target];
			if (promisesArray == null) {
				promisesArray = [];
				promisesMap[target] = promisesArray;
			}

			var item = {promise: promise, args: args};
			promisesArray.push(item);

			var triggerOptions = {
				xhr: promise,
				args: args
			};
			if (globalPromise == null) {
				globalPromise = Promise.all([promise]);

				kudu.emit("global.ajax.start", triggerOptions);
				triggerOptions.args = args;
				kudu.emit("ajax.start", triggerOptions);

			} else {
				globalPromise = Promise.all([globalPromise, promise]);
				/*
				 if (args != null) {
				 globalPromiseArgs = jqutils.extend(globalPromiseArgs, args);
				 }*/
				triggerOptions.args = args;
				kudu.emit("ajax.start", triggerOptions);
			}
			globalPromise._id = idCounter++;

			addListeners(target, globalPromise, promise, args);
			//console.log("DONE registering", globalPromise._id);

			promiseCounter++;

			return globalPromise;
		};

		that.remove = function (target, promise) {
			var jqpromiseArray = promisesMap[target];
			if (jqpromiseArray == null) {
				return false;
			}

			var index = -1;
			for (var i = 0; i < jqpromiseArray.length; i++) {
				var item = jqpromiseArray[i];
				if (item.promise === promise) {
					index = i;
					break;
				}
			}

			if (index >= 0) {
				jqpromiseArray.splice(index, 1);
				if (jqpromiseArray.length === 0) {
					delete promisesMap[target];
				}
				promiseCounter--;
				return true;
			}
			return false;
		};

		that.clear = function (target) {
			if (arguments.length === 0) {
				promisesMap = {};

			} else {
				delete promisesMap[target];
			}
		};

		that.abort = function (target) {
			if (arguments.length === 0) {
				for (var key in promisesMap) {
					if (promisesMap.hasOwnProperty(key)) {
						var promisesArray = promisesMap[key];
						abortItems(promisesArray);

					}
				}


				abortItems(promisesArray);

				return;
			}

			var promisesArray = promisesMap[target];
			if (promisesArray == null) {
				return;
			}

			abortItems(promisesArray);
		};

		function abortItems(promisesArray) {
			// promiseArray could be manipulated outside the loop below, so we make a copy
			var promisesCopy = promisesArray.slice();
			promisesCopy.forEach(function (item, index) {
				item.promise.abort();
			});
			globalPromise = null;
			//globalPromiseArgs = {};			
		}

		function addListeners(target, globalPromiseParam, promiseParam, args) {

			promiseParam.then(function (value) {

				var triggerOptions;

				if (isXhr(value.xhr)) {
					triggerOptions = {data: value.data, status: value.status, xhr: value.xhr, args: args};

				} else {
					var promiseArgs;
					if (arguments.length > 0) {
						promiseArgs = Array.prototype.slice.call(arguments);
					}
					triggerOptions = {data: null, status: null, xhr: null, error: null, args: args, promiseArgs: promiseArgs};
				}

				kudu.emit("ajax.success", triggerOptions);

			}).catch(function (reason) {

				var triggerOptions;

				if (isXhr(reason.xhr)) {
					triggerOptions = {error: reason.error, status: reason.status, xhr: reason.xhr, args: args};

				} else {
					var promiseArgs;
					if (arguments.length > 0) {
						promiseArgs = Array.prototype.slice.call(arguments);
					}
					triggerOptions = {data: null, status: null, xhr: null, error: null, args: args, promiseArgs: promiseArgs};
				}

				kudu.emit("ajax.error", triggerOptions);
			});
			
			promiseParam.then(function (value) {
				always(value, true);
			}).catch(function (reason) {
				always(reason, false);
			});

			function always(value, success) {
				// Note: the promise might not be an ajax request at all!

				var triggerOptions;

				if (isXhr(value.xhr)) {
					// not an ajax request, just normal promise
					var promiseArgs;
					if (arguments.length > 0) {
						promiseArgs = Array.prototype.slice.call(arguments);
					}
					triggerOptions = {data: null, status: null, xhr: null, error: null, args: args, promiseArgs: promiseArgs};

				} else {

					if (success === true) {
						triggerOptions = {data: value.data, status: value.status, xhr: value.xhr, error: null, args: args};

					} else {
						triggerOptions = {data: null, status: value.status, xhr: value.xhr, error: value.error, args: args};
					}
				}


				kudu.emit("ajax.complete", triggerOptions);
				var removed = that.remove(target, promiseParam);
				//console.log("Removed?", removed);
			}

			globalPromiseParam.then(function (value) {

				var triggerOptions;

				if (isXhr(value.xhr)) {
					triggerOptions = {data: value.data, status: value.status, xhr: value.xhr, args: args};

				} else {
					var promiseArgs;
					if (arguments.length > 0) {
						promiseArgs = Array.prototype.slice.call(arguments);
					}
					triggerOptions = {data: null, status: null, xhr: null, error: null, args: args, promiseArgs: promiseArgs};
				}

				// Only process if this is the globalPromise, otherwise globalPromise has been overwritten
				if (globalPromise == null || globalPromise == globalPromiseParam) {

					kudu.emit("ajax.stop", triggerOptions);

					delete triggerOptions.args;
					kudu.emit("global.ajax.stop", triggerOptions);
					globalPromise = null;
					//globalPromiseArgs = {};
				} else {
					//console.log("globalPromise ignore then");
					kudu.emit("ajax.stop", triggerOptions);
				}

			}).catch(function (reason) {

				var triggerOptions;

				if (isXhr(reason.xhr)) {
					triggerOptions = {error: reason.error, status: reason.status, xhr: reason.xhr, args: args};

				} else {
					var promiseArgs;
					if (arguments.length > 0) {
						promiseArgs = Array.prototype.slice.call(arguments);
					}

					triggerOptions = {data: null, status: null, xhr: null, error: null, args: args, promiseArgs: promiseArgs};
				}

				if (globalPromise == null || globalPromise == globalPromiseParam) {

					kudu.emit("ajax.stop", triggerOptions);

					delete triggerOptions.args;
					kudu.emit("global.ajax.stop", triggerOptions);
					globalPromise = null;
					//globalPromiseArgs = {};
					//console.log("globalPromise ERROR", globalPromiseParam);
					//console.log(arguments);

				} else {
					//console.log("globalPromise ignore error");
					kudu.emit("ajax.stop", triggerOptions);
					return;
				}
			});
			/*
			 globalPromiseParam.always(function () {
			 
			 if (globalPromise == null || globalPromise == globalPromiseParam) {
			 //console.log("globalPromise ALWAYS", arguments);
			 //console.log("Promises size1:", utils.objectLength(jqXHRMap));
			 //console.log("Promises size2:", promiseCounter);
			 
			 } else {
			 //console.log("globalPromise ignore always");
			 return;
			 }
			 });*/
		}

		function isXhr(xhr) {
			if (xhr != null) {
				if (typeof xhr.getAllResponseHeaders === 'function' && typeof xhr.abort === 'function') {
					// assume dataOrjqXHR is a jqXHR and thus an Ajax request
					return true;
				}
			}

			return false;
		}

		return that;
	}

	return ajaxTracker;
});

define('utils/simpleAjaxTracker',['require'],function (require) {

	var simpleAjaxTracker = {};

	simpleAjaxTracker.create = function (ajaxTracker, options) {
		var adaptor = {
			add: function (jqXhr, args) {
				ajaxTracker.add(options.target, jqXhr, args);
			},
			remove: function (jqXhr) {
				ajaxTracker.remove(options.target, jqXhr);
			},
			abort: function () {
				ajaxTracker.abort(options.target);
			}
		};

		return adaptor;
	};

	return simpleAjaxTracker;
});

define('lifecycle/onInitHandler',['require','../utils/jqr/npo'],function (require) {

	require("../utils/jqr/npo");

	function onInitHandler(options) {

		var promise = new Promise(function (resolve, reject) {

			if (typeof options.ctrl.onInit !== 'function') {
				reject("Controllers *must* implement an onInit method that returns either a Ractive function or a promise that resolves to a Ractive function!");
				return promise;
			}

			var viewOptions = {
				ctrl: options.ctrl,
				route: options.route,
				routeParams: options.routeParams,
				args: options.args,
				ajaxTracker: options.ajaxTracker,
				prev: options.prev
			};

			var ractiveFnOrPromise = options.ctrl.onInit(viewOptions);

			resolve(ractiveFnOrPromise);

			/*
			 if (options.createView) {
			 promise = options.createView(options);
			 } else {
			 promise = createView(options);
			 }*/
		});

		return promise;
	}

	return onInitHandler;
});
define('lifecycle/onRemoveHandler',['require','../utils/utils','../utils/jqr/npo'],function (require) {

	var utils = require("../utils/utils");
	require("../utils/jqr/npo");

	function onRemoveHandler(options) {

		var promise = new Promise(function (resolve, reject) {

			if (typeof options.ctrl.onRemove !== 'function') {
				resolve();
				return promise;
			}

			var viewOptions = {
				ctrl: options.ctrl,
				route: options.route,
				routeParams: options.routeParams,
				args: options.args,
				view: options.view,
				ajaxTracker: options.ajaxTracker,
				next: options.next
			};

			var booleanOrPromise = options.ctrl.onRemove(viewOptions);

			if (booleanOrPromise == null || booleanOrPromise == true) {
				resolve();
				return promise;
			}

			if (booleanOrPromise == false) {
				reject("controller onRemove() returned false");
				return promise;
			}

			if (utils.isPromise(booleanOrPromise)) {
				booleanOrPromise.then(function (bool) {

					// Request could have been overwritten by new request. Ensure this is still the active request
					if (!options.mvc.requestTracker.active) {
						reject("Request overwritten by another view request");
						return promise;
					}

					if (bool == null || bool == true) {
						resolve();
					} else {
						reject();
					}
				}).catch(function () {
					// onRemove promise rejected
					reject();

				});

			} else {
				console.warn("Ignoring new view since onRemove did not return a valid response. onRemove must return either true/false or a promise that resolves to true/false.");
				reject();
			}
		});
		return promise;
	}

	return onRemoveHandler;
});
define('ractivelib/setupEvents',['require'],function (require) {

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
			this.transitionsEnabled = true;
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
define('ractivelib/setupDefaultEvents',['require','ractive'],function (require) {

	//var $ = require("jquery");
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
define('utils/jqr/fade',['require'],function (require) {

	function fade() {

		var that = {};

		var speeds = {
			slow: 600,
			fast: 200,
			// Default speed
			default: 400
		};

		var fxOff = false;

		var queue = [];

		var queueObj = {
			fadeIn: false,
			el: null,
			cb: null,
			requestId: null,
			timeoutId: null,
		};

		that.off = function (val) {
			fxOff = val;
		};

		that.stop = function () {

			queue.forEach(function (item, i) {
				if (item.fadeIn) {
					item.el.style.opacity = 1;
				} else {
					item.el.style.opacity = 0;
				}

				if (item.timeoutId != null) {
					clearTimeout(item.timeoutId);
				}
				if (item.requestId != null) {
					cancelAnimationFrame(item.requestId);
				}

				if (item.cb != null) {
					item.cb();
					item.cb = null;
				}
			});
			// Reset queue and remove all handles to stored items
			queue = [];
		};

		that.queue = function () {
			return queue;
		};

		that.dequeue = function (item) {
			var i = queue.length - 1;
			while (i >= 0) {
				if (queue[i] === item) {
					queue.splice(i, 1);
					break;
				}
			}
		};

		that.fadeIn = function (el, options, cb) {
			if (typeof options === "function") {
				cb = options;
				options = {};
			}

			options = options || {};

			if (fxOff || options.duration == 0) {
				el.style.opacity = 1;
				if (cb) {
					cb();
				}
				return;
			}

			options.duration = calcDuration(options.duration);

			queueObj = {
				fadeIn: true,
				el: el,
				cb: cb
			};
			queue.push(queueObj);

			var temp = window.getComputedStyle(el).getPropertyValue("opacity");
			el.style.opacity = +temp;

			var last = +new Date();
			var tick = function () {

				var change = (new Date() - last) / options.duration;
				var val = +el.style.opacity + change;
				el.style.opacity = val;
				last = +new Date();

				if (+el.style.opacity < 1) {

					if (window.requestAnimationFrame) {
						queueObj.requestId = requestAnimationFrame(tick);
					} else {
						queueObj.timeoutId = setTimeout(tick, 16);
					}

				} else {
					that.dequeue(queueObj);
					if (queueObj.cb) {
						cb();
					}
				}
			};

			tick();
		};

		that.fadeOut = function (el, options, cb) {
			if (typeof options === "function") {
				cb = options;
				options = {};
			}

			options = options || {};

			if (fxOff || options.duration == 0) {
				el.style.opacity = 0;
				if (cb) {
					cb();
				}
				return;
			}

			options.duration = calcDuration(options.duration);

			queueObj = {
				fadeIn: false,
				el: el,
				cb: cb
			};
			queue.push(queueObj);

			var temp = window.getComputedStyle(el).getPropertyValue("opacity");
			el.style.opacity = +temp;

			var last = +new Date();
			var tick = function () {
				var change = (new Date() - last) / options.duration;
				var val = +el.style.opacity - change;
				el.style.opacity = val;
				last = +new Date();

				if (+el.style.opacity > 0) {
					if (window.requestAnimationFrame) {
						queueObj.requestId = requestAnimationFrame(tick);
					} else {
						queueObj.timeoutId = setTimeout(tick, 16);
					}

				} else {
					that.dequeue(queueObj);
					if (queueObj.cb) {
						cb();
					}
				}
			};

			tick();
		};

		function calcDuration(duration) {
			if (typeof duration !== "number") {
				duration = duration in speeds ? speeds[duration] : speeds.default;
			}
			return duration;
		}

		return that;
	}

	var fade = fade();
	return fade;
});


define('transition/fade',['require','../utils/jqr/fade'],function (require) {

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



define('transition/intro',['require','../utils/jqr/npo','./fade'],function (require) {

	require("../utils/jqr/npo");
	var fade = require("./fade");

	function intro(options) {

		var promise = new Promise(function (resolve, reject) {

			if (options.fx !== true) {
				resolve();
				return promise;
			}

			var transition = options.intro || fade.intro;

			transition(options, resolve);
		});

		return promise;
	}
	return intro;
});
define('transition/outro',['require','../utils/jqr/npo','./fade'],function (require) {

	require("../utils/jqr/npo");
	var fade = require("./fade");

	function outro(options) {

		var promise = new Promise(function (resolve, reject) {

			if (options.fx !== true) {
				resolve();
				return promise;
			}

			var transition = options.outro || fade.outro;

			transition(options, resolve);
		});

		return promise;
	}
	return outro;
});
define('utils/severity',['require'],function (require) {

	function severity() {

		this.DEBUG = 0;
		this.INFO = 1;
		this.WARNING = 2;
		this.ERROR = 3;
	}

	return new severity();
});

define('ractivelib/render/create',['require','../../utils/jqr/npo','../../utils/utils','../../utils/jqr/jqutils','../../utils/severity'],function (require) {

	require("../../utils/jqr/npo");
	var utils = require("../../utils/utils");
	var jqutils = require("../../utils/jqr/jqutils");
	var severity = require("../../utils/severity");

	function create(options) {

		var promise = new Promise(function (resolve, reject) {

			if (options.viewOrPromise == null) {
				console.warn("Ignoring view since onInit returned null. onInit must return either a Ractive function or a promise that resolves to a Ractive function.");
				// TODO how to handle errors in kudu generically?
				reject({level: severity.INFO, message: "Ignoring view since onInit returned null. onInit must return either a Ractive function or a promise that resolves to a Ractive function."});
				return promise;
			}

			if (utils.isPromise(options.viewOrPromise)) {

				options.viewOrPromise.then(function (ractiveObj) {

					if (typeof ractiveObj === 'function') {
						ractiveObj = new ractiveObj();
					}

					// Request could have been overwritten by new request. Ensure this is still the active request
					if (!options.mvc.requestTracker.active) {
						reject("Request overwritten by another view request");
						return promise;
					}

					var view = ractiveObj;
					resolve(view);

				}).catch(function () {
					if (!options.mvc.requestTracker.active && arguments.length === 0) {
						reject("Request overwritten by another view request");
					} else {
						// if the Ctrl.onInit() call rejected promise
						reject.apply(undefined, arguments);

					}

				});

			} else if (jqutils.isFunction(options.viewOrPromise)) {
				// Assume it is a Ractive function
				// Should this scenrio be supported? How will the view receive an instance to the ractive
				//options.kudu.createRactive(RactiveFnOrPromise);
				var view = new options.viewOrPromise();
				resolve(view);

			} else if (utils.isRactiveObject(options.viewOrPromise)) {
				// Assume it is a Ractive instance
				var view = options.viewOrPromise;
				resolve(view);

			} else {
				console.warn("Ignoring view since onInit did not return a valid response. onInit must return either a Ractive function or a promise that resolves to a Ractive function.");
				reject("Ignoring view since onInit did not return a valid response. onInit must return either a Ractive function or a promise that resolves to a Ractive function.");
			}
		});

		return promise;
	}

	return create;
});
define('ractivelib/render/render',['require','../../utils/jqr/npo'],function (require) {

	require("../../utils/jqr/npo");

	function render(options) {

		var promise = new Promise(function (resolve, reject) {

			options.view.transitionsEnabled = false;

			options.view.render(options.target).then(function () {

				options.view.transitionsEnabled = true;

				resolve(options.view);

			}).catch(function (error) {
				reject.apply(undefined, [error, options.view]);
			});
		});

		return promise;
	}
	return render;
});
define('ractivelib/render/unrender',['require','../../utils/jqr/npo'],function (require) {

	require("../../utils/jqr/npo");

	function unrender(options) {

		var promise = new Promise(function (resolve, reject) {

			options.mvc.view.transitionsEnabled = false;
			//options.view.transitionsEnabled = false;

			options.mvc.view.unrender().then(function () {

				resolve(options.view);

			}).catch(function (error) {
				reject.apply(undefined, [error, options.view]);
			});
		});

		return promise;
	}
	return unrender;
});
define('ractivelib/RactiveViewFactory',['require','./render/create','./render/render','./render/unrender'],function (require) {

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
/*!
 * EventEmitter v4.2.11 - git.io/ee
 * Unlicense - http://unlicense.org/
 * Oliver Caldwell - http://oli.me.uk/
 * @preserve
 */

;(function () {
    'use strict';

    /**
     * Class for managing events.
     * Can be extended to provide event functionality in other classes.
     *
     * @class EventEmitter Manages event registering and emitting.
     */
    function EventEmitter() {}

    // Shortcuts to improve speed and size
    var proto = EventEmitter.prototype;
    var exports = this;
    var originalGlobalValue = exports.EventEmitter;

    /**
     * Finds the index of the listener for the event in its storage array.
     *
     * @param {Function[]} listeners Array of listeners to search through.
     * @param {Function} listener Method to look for.
     * @return {Number} Index of the specified listener, -1 if not found
     * @api private
     */
    function indexOfListener(listeners, listener) {
        var i = listeners.length;
        while (i--) {
            if (listeners[i].listener === listener) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Alias a method while keeping the context correct, to allow for overwriting of target method.
     *
     * @param {String} name The name of the target method.
     * @return {Function} The aliased method
     * @api private
     */
    function alias(name) {
        return function aliasClosure() {
            return this[name].apply(this, arguments);
        };
    }

    /**
     * Returns the listener array for the specified event.
     * Will initialise the event object and listener arrays if required.
     * Will return an object if you use a regex search. The object contains keys for each matched event. So /ba[rz]/ might return an object containing bar and baz. But only if you have either defined them with defineEvent or added some listeners to them.
     * Each property in the object response is an array of listener functions.
     *
     * @param {String|RegExp} evt Name of the event to return the listeners from.
     * @return {Function[]|Object} All listener functions for the event.
     */
    proto.getListeners = function getListeners(evt) {
        var events = this._getEvents();
        var response;
        var key;

        // Return a concatenated array of all matching events if
        // the selector is a regular expression.
        if (evt instanceof RegExp) {
            response = {};
            for (key in events) {
                if (events.hasOwnProperty(key) && evt.test(key)) {
                    response[key] = events[key];
                }
            }
        }
        else {
            response = events[evt] || (events[evt] = []);
        }

        return response;
    };

    /**
     * Takes a list of listener objects and flattens it into a list of listener functions.
     *
     * @param {Object[]} listeners Raw listener objects.
     * @return {Function[]} Just the listener functions.
     */
    proto.flattenListeners = function flattenListeners(listeners) {
        var flatListeners = [];
        var i;

        for (i = 0; i < listeners.length; i += 1) {
            flatListeners.push(listeners[i].listener);
        }

        return flatListeners;
    };

    /**
     * Fetches the requested listeners via getListeners but will always return the results inside an object. This is mainly for internal use but others may find it useful.
     *
     * @param {String|RegExp} evt Name of the event to return the listeners from.
     * @return {Object} All listener functions for an event in an object.
     */
    proto.getListenersAsObject = function getListenersAsObject(evt) {
        var listeners = this.getListeners(evt);
        var response;

        if (listeners instanceof Array) {
            response = {};
            response[evt] = listeners;
        }

        return response || listeners;
    };

    /**
     * Adds a listener function to the specified event.
     * The listener will not be added if it is a duplicate.
     * If the listener returns true then it will be removed after it is called.
     * If you pass a regular expression as the event name then the listener will be added to all events that match it.
     *
     * @param {String|RegExp} evt Name of the event to attach the listener to.
     * @param {Function} listener Method to be called when the event is emitted. If the function returns true then it will be removed after calling.
     * @return {Object} Current instance of EventEmitter for chaining.
     */
    proto.addListener = function addListener(evt, listener) {
        var listeners = this.getListenersAsObject(evt);
        var listenerIsWrapped = typeof listener === 'object';
        var key;

        for (key in listeners) {
            if (listeners.hasOwnProperty(key) && indexOfListener(listeners[key], listener) === -1) {
                listeners[key].push(listenerIsWrapped ? listener : {
                    listener: listener,
                    once: false
                });
            }
        }

        return this;
    };

    /**
     * Alias of addListener
     */
    proto.on = alias('addListener');

    /**
     * Semi-alias of addListener. It will add a listener that will be
     * automatically removed after its first execution.
     *
     * @param {String|RegExp} evt Name of the event to attach the listener to.
     * @param {Function} listener Method to be called when the event is emitted. If the function returns true then it will be removed after calling.
     * @return {Object} Current instance of EventEmitter for chaining.
     */
    proto.addOnceListener = function addOnceListener(evt, listener) {
        return this.addListener(evt, {
            listener: listener,
            once: true
        });
    };

    /**
     * Alias of addOnceListener.
     */
    proto.once = alias('addOnceListener');

    /**
     * Defines an event name. This is required if you want to use a regex to add a listener to multiple events at once. If you don't do this then how do you expect it to know what event to add to? Should it just add to every possible match for a regex? No. That is scary and bad.
     * You need to tell it what event names should be matched by a regex.
     *
     * @param {String} evt Name of the event to create.
     * @return {Object} Current instance of EventEmitter for chaining.
     */
    proto.defineEvent = function defineEvent(evt) {
        this.getListeners(evt);
        return this;
    };

    /**
     * Uses defineEvent to define multiple events.
     *
     * @param {String[]} evts An array of event names to define.
     * @return {Object} Current instance of EventEmitter for chaining.
     */
    proto.defineEvents = function defineEvents(evts) {
        for (var i = 0; i < evts.length; i += 1) {
            this.defineEvent(evts[i]);
        }
        return this;
    };

    /**
     * Removes a listener function from the specified event.
     * When passed a regular expression as the event name, it will remove the listener from all events that match it.
     *
     * @param {String|RegExp} evt Name of the event to remove the listener from.
     * @param {Function} listener Method to remove from the event.
     * @return {Object} Current instance of EventEmitter for chaining.
     */
    proto.removeListener = function removeListener(evt, listener) {
		if (listener == null) {
			return this.removeEvent(evt);
		}
        var listeners = this.getListenersAsObject(evt);
        var index;
        var key;

        for (key in listeners) {
            if (listeners.hasOwnProperty(key)) {
                index = indexOfListener(listeners[key], listener);

                if (index !== -1) {
                    listeners[key].splice(index, 1);
                }
            }
        }

        return this;
    };

    /**
     * Alias of removeListener
     */
    proto.off = alias('removeListener');

    /**
     * Adds listeners in bulk using the manipulateListeners method.
     * If you pass an object as the second argument you can add to multiple events at once. The object should contain key value pairs of events and listeners or listener arrays. You can also pass it an event name and an array of listeners to be added.
     * You can also pass it a regular expression to add the array of listeners to all events that match it.
     * Yeah, this function does quite a bit. That's probably a bad thing.
     *
     * @param {String|Object|RegExp} evt An event name if you will pass an array of listeners next. An object if you wish to add to multiple events at once.
     * @param {Function[]} [listeners] An optional array of listener functions to add.
     * @return {Object} Current instance of EventEmitter for chaining.
     */
    proto.addListeners = function addListeners(evt, listeners) {
        // Pass through to manipulateListeners
        return this.manipulateListeners(false, evt, listeners);
    };

    /**
     * Removes listeners in bulk using the manipulateListeners method.
     * If you pass an object as the second argument you can remove from multiple events at once. The object should contain key value pairs of events and listeners or listener arrays.
     * You can also pass it an event name and an array of listeners to be removed.
     * You can also pass it a regular expression to remove the listeners from all events that match it.
     *
     * @param {String|Object|RegExp} evt An event name if you will pass an array of listeners next. An object if you wish to remove from multiple events at once.
     * @param {Function[]} [listeners] An optional array of listener functions to remove.
     * @return {Object} Current instance of EventEmitter for chaining.
     */
    proto.removeListeners = function removeListeners(evt, listeners) {
        // Pass through to manipulateListeners
        return this.manipulateListeners(true, evt, listeners);
    };

    /**
     * Edits listeners in bulk. The addListeners and removeListeners methods both use this to do their job. You should really use those instead, this is a little lower level.
     * The first argument will determine if the listeners are removed (true) or added (false).
     * If you pass an object as the second argument you can add/remove from multiple events at once. The object should contain key value pairs of events and listeners or listener arrays.
     * You can also pass it an event name and an array of listeners to be added/removed.
     * You can also pass it a regular expression to manipulate the listeners of all events that match it.
     *
     * @param {Boolean} remove True if you want to remove listeners, false if you want to add.
     * @param {String|Object|RegExp} evt An event name if you will pass an array of listeners next. An object if you wish to add/remove from multiple events at once.
     * @param {Function[]} [listeners] An optional array of listener functions to add/remove.
     * @return {Object} Current instance of EventEmitter for chaining.
     */
    proto.manipulateListeners = function manipulateListeners(remove, evt, listeners) {
        var i;
        var value;
        var single = remove ? this.removeListener : this.addListener;
        var multiple = remove ? this.removeListeners : this.addListeners;

        // If evt is an object then pass each of its properties to this method
        if (typeof evt === 'object' && !(evt instanceof RegExp)) {
            for (i in evt) {
                if (evt.hasOwnProperty(i) && (value = evt[i])) {
                    // Pass the single listener straight through to the singular method
                    if (typeof value === 'function') {
                        single.call(this, i, value);
                    }
                    else {
                        // Otherwise pass back to the multiple function
                        multiple.call(this, i, value);
                    }
                }
            }
        }
        else {
            // So evt must be a string
            // And listeners must be an array of listeners
            // Loop over it and pass each one to the multiple method
            i = listeners.length;
            while (i--) {
                single.call(this, evt, listeners[i]);
            }
        }

        return this;
    };

    /**
     * Removes all listeners from a specified event.
     * If you do not specify an event then all listeners will be removed.
     * That means every event will be emptied.
     * You can also pass a regex to remove all events that match it.
     *
     * @param {String|RegExp} [evt] Optional name of the event to remove all listeners for. Will remove from every event if not passed.
     * @return {Object} Current instance of EventEmitter for chaining.
     */
    proto.removeEvent = function removeEvent(evt) {
        var type = typeof evt;
        var events = this._getEvents();
        var key;

        // Remove different things depending on the state of evt
        if (type === 'string') {
            // Remove all listeners for the specified event
            delete events[evt];
        }
        else if (evt instanceof RegExp) {
            // Remove all events matching the regex.
            for (key in events) {
                if (events.hasOwnProperty(key) && evt.test(key)) {
                    delete events[key];
                }
            }
        }
        else {
            // Remove all listeners in all events
            delete this._events;
        }

        return this;
    };

    /**
     * Alias of removeEvent.
     *
     * Added to mirror the node API.
     */
    proto.removeAllListeners = alias('removeEvent');

    /**
     * Emits an event of your choice.
     * When emitted, every listener attached to that event will be executed.
     * If you pass the optional argument array then those arguments will be passed to every listener upon execution.
     * Because it uses `apply`, your array of arguments will be passed as if you wrote them out separately.
     * So they will not arrive within the array on the other side, they will be separate.
     * You can also pass a regular expression to emit to all events that match it.
     *
     * @param {String|RegExp} evt Name of the event to emit and execute listeners for.
     * @param {Array} [args] Optional array of arguments to be passed to each listener.
     * @return {Object} Current instance of EventEmitter for chaining.
     */
    proto.emitEvent = function emitEvent(evt, args) {
        var listenersMap = this.getListenersAsObject(evt);
        var listeners;
        var listener;
        var i;
        var key;
        var response;

        for (key in listenersMap) {
            if (listenersMap.hasOwnProperty(key)) {
                listeners = listenersMap[key].slice(0);
                i = listeners.length;

                while (i--) {
                    // If the listener returns true then it shall be removed from the event
                    // The function is executed either with a basic call or an apply if there is an args array
                    listener = listeners[i];

                    if (listener.once === true) {
                        this.removeListener(evt, listener.listener);
                    }

                    response = listener.listener.apply(this, args || []);

                    if (response === this._getOnceReturnValue()) {
                        this.removeListener(evt, listener.listener);
                    }
                }
            }
        }

        return this;
    };

    /**
     * Alias of emitEvent
     */
    proto.trigger = alias('emitEvent');

    /**
     * Subtly different from emitEvent in that it will pass its arguments on to the listeners, as opposed to taking a single array of arguments to pass on.
     * As with emitEvent, you can pass a regex in place of the event name to emit to all events that match it.
     *
     * @param {String|RegExp} evt Name of the event to emit and execute listeners for.
     * @param {...*} Optional additional arguments to be passed to each listener.
     * @return {Object} Current instance of EventEmitter for chaining.
     */
    proto.emit = function emit(evt) {
        var args = Array.prototype.slice.call(arguments, 1);
        return this.emitEvent(evt, args);
    };

    /**
     * Sets the current value to check against when executing listeners. If a
     * listeners return value matches the one set here then it will be removed
     * after execution. This value defaults to true.
     *
     * @param {*} value The new value to check for when executing listeners.
     * @return {Object} Current instance of EventEmitter for chaining.
     */
    proto.setOnceReturnValue = function setOnceReturnValue(value) {
        this._onceReturnValue = value;
        return this;
    };

    /**
     * Fetches the current value to check against when executing listeners. If
     * the listeners return value matches this one then it should be removed
     * automatically. It will return true by default.
     *
     * @return {*|Boolean} The current value to check for or the default, true.
     * @api private
     */
    proto._getOnceReturnValue = function _getOnceReturnValue() {
        if (this.hasOwnProperty('_onceReturnValue')) {
            return this._onceReturnValue;
        }
        else {
            return true;
        }
    };

    /**
     * Fetches the events object and creates one if required.
     *
     * @return {Object} The events storage object.
     * @api private
     */
    proto._getEvents = function _getEvents() {
        return this._events || (this._events = {});
    };

    /**
     * Reverts the global {@link EventEmitter} to its previous value and returns a reference to this version.
     *
     * @return {Function} Non conflicting EventEmitter class.
     */
    EventEmitter.noConflict = function noConflict() {
        exports.EventEmitter = originalGlobalValue;
        return EventEmitter;
    };

    // Expose the class either via AMD, CommonJS or the global object
    if (typeof define === 'function' && define.amd) {
        define('utils/jqr/EventEmitter',[],function () {
            return EventEmitter;
        });
    }
    else if (typeof module === 'object' && module.exports){
        module.exports = EventEmitter;
    }
    else {
        exports.EventEmitter = EventEmitter;
    }
}.call(this));
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

define('kudu',['require','./router/router','./utils/jqr/npo','ractive','./utils/ajaxTracker','./utils/simpleAjaxTracker','./lifecycle/onInitHandler','./lifecycle/onRemoveHandler','./ractivelib/setupEvents','./ractivelib/setupDefaultEvents','./transition/intro','./transition/outro','./ractivelib/RactiveViewFactory','./utils/severity','./utils/utils','./utils/jqr/jqutils','./utils/jqr/EventEmitter','./utils/jqr/fade'],function (require) {

	var router = require("./router/router");
	require("./utils/jqr/npo");
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
	var jqutils = require("./utils/jqr/jqutils");
	var EventEmitter = require("./utils/jqr/EventEmitter");
	var jqfade = require("./utils/jqr/fade");

	function kudu() {

		var that = new EventEmitter();

		// 
		var reenableAnimationTracker = {enable: true};

		//var routes;

		var currentMVC = {
			view: null,
			ctrl: null,
			requestTracker: {active: true},
			route: null,
			options: {
				routeParams: null,
				args: null
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

		var ajaxTracker = ajaxTrackerFn(that);

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
					///console.log("+1")
					//$.fx.off = true;
					//$(options.target).stop(true, true);
					jqfade.off(true);
					jqfade.stop();
					reenableAnimationTracker.enable = false;
				}

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
						currentMVC.view.transitionsEnabled = true;
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
							reject.apply(undefined, ["Request overwritten by another view request [leaveCleanUp]", options.mvc.view]);
							return;
						}

						resolve();

					}).catch(function (error) {
						reject.apply(undefined, [error, options.view]);
					});

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
					enterCleanupFn = utils.noopPromise;

					enterOptions = options; // set leaveOptions to options, since we are going to use unrenderView instead
				}

				var enterPromise = enterFn(enterOptions);
				if (enterPromise == null) {
					enterPromise = utils.noopPromise();
				}

				enterPromise.then(function () {

					enterCleanupFn(options).then(function () {
						resolve(options.view);

					}).catch(function (error) {
						reject.apply(undefined, [error, options.view]);
					});

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

				renderPromise.then(function () {

					that.renderViewCleanup(options).then(function () {

						resolve(options.view);

					}).catch(function (error) {
						reject.apply(undefined, [error, options.view]);
					});

				}).catch(function (error) {
					reject.apply(undefined, [error, options.view]);
				});
			});

			return promise;
		};

		that.renderViewCleanup = function (options) {
			var promise = new Promise(function (resolve, reject) {

				// Store new controller and view on currentMVC
				that.updateMVC(options);

				//options.view.transitionsEnabled = true;

				// Seems that Ractive render swallows errors so here we catch and log errors thrown by the render event
				try {
					that.callViewEvent("onRender", options);
					that.triggerEvent("render", options);

				} catch (error) {
					reject(error);
					return promise;
				}
				resolve();
			});
			return promise;
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

						that.unrenderViewCleanup(options).then(function () {

							if (!options.mvc.requestTracker.active) {
								reject.apply(undefined, ["Request overwritten by another view request in [unrenderView]", options.mvc.view]);
								return;
							}

							resolve(options.mvc.view);

						}).catch(function (error) {
							reject.apply(undefined, [error, options.view]);
						});

					}).catch(function () {

						reject(options.mvc.view);

					});
				}
			});

			return promise;
		};

		that.unrenderViewCleanup = function (options) {
			var promise = new Promise(function (resolve, reject) {

				// Seems that Ractive unrender swallows errors so here we catch and log errors thrown by the unrender event
				try {
					that.callViewEvent("onUnrender", options);
					that.triggerEvent("unrender", options);

				} catch (error) {
					reject(error);
					return promise;
				}

				resolve();
			});
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
					//$.fx.off = false;
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

