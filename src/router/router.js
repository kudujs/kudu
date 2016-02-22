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

define(function (require) {
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

				route.moduleId = route.ctrl._kudu_id;
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
				moduleId = ctrl._kudu_id;
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
				console.error("No route matched request to Controller '" + ctrl._kudu_id + "'! Available routes for this controller: ");
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
				throw new Error("Cannot route to controller '" + ctrl._kudu_id + "' since it's route path is a RegExp '" + routePath + "'");
			}

			if (routePath.indexOf('*') !== -1) {
				throw new Error("Cannot route to controller '" + ctrl._kudu_id + "' since it's route path contains wildcards '*'. The given route for the controller is '" + routePath + "'");
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
							throw new Error("Cannot route to controller '" + ctrl._kudu_id + "' since it's route requires the path parameter '"
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
						throw new Error("Cannot route to controller '" + ctrl._kudu_id + "' since it's route requires the query parameter '"
								+ routeParamKey + "' but no routeParams was provided");
					} else {
						var routeParamValue = routeParams[routeParamKey];
						if (routeParamValue === undefined) {
							// TODO test this scenario
							throw new Error("Cannot route to controller '" + ctrl._kudu_id + "' since it's route requires the query parameter '"
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
			var moduleId = module._kudu_id;
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

	function resolveUnknownRoutes(options) {

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