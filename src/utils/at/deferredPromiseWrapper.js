define( function ( require ) {
	
	var utils = require("../utils");

	function deferredPromiseWrapper() {

		var that = { };

		that.canWrap = function ( obj ) {
			if ( isDeferred( obj ) && typeof obj.then === 'function' ) {
				return true;
			}
			return false;
		};

		that.wrap = function ( deferred ) {
			var es6Promise = new Promise( function ( resolve, reject ) {

				deferred.then( function ( obj ) {
/*
					if (utils.isObject(obj)) {
						resolve( { data: obj.data, status: obj.status, xhr: obj.xhr } );

					} else {
						resolve(obj);
					}*/
					resolve(obj);

				}, function ( obj ) {
					/*
					if (utils.isObject(obj)) {
						reject( { error: obj.error, status: obj.status, xhr: obj.xhr } );

					} else {
						reject(obj);
					}*/
					reject(obj);
				} );

				deferred.then( resolve, reject );
			} );
			es6Promise.abort = function () {
				deferred.abort();
			};
			return es6Promise;

		};

		function isDeferred( obj ) {

			if ( obj != null ) {
				if ( typeof obj.pipe === "function" && typeof obj.promise === "function" && typeof obj.state === "function") {
					// assume is a deferred
					return true;
				}
				return false;
			}

			return false;
		}

		return that;
	}
	return deferredPromiseWrapper();
} );
