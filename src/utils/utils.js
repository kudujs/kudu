define( function ( require ) {

	require( "./jqr/npo" );
	var mode = require( "./mode" );
	var severity = require( "./severity" );

	// Define a console that works in all browsers
	function consoleLog( type ) {
		var console = window.console || { },
				logFn = console[type] || console.log || function () {},
				hasApply = false;

		// Note: reading logFn.apply throws an error in IE11 in IE8 document mode.
		// The reason behind this is that console.log has type "object" in IE8...
		try {
			hasApply = ! ! logFn.apply;
		} catch ( e ) {
		}

		if ( hasApply ) {
			return function () {
				return logFn.apply( console, arguments );
			};
		} else {
			// we are IE where console.log doesn't have apply so we log at least first 2 args
			return function ( arg1, arg2 ) {
				return logFn( arg1, arg2 == null ? '' : arg2 );
			}
		}
	}

	var $log = {
		log: consoleLog( 'log' ),
		warn: consoleLog( 'warn' ),
		info: consoleLog( 'info' ),
		error: consoleLog( 'error' )
	};

	function utils( options ) {

		var that = { };


		var noopPromiseFn = new Promise( function ( resolve, reject ) {
			resolve();
		} );

		that.noopPromise = function () {
			return noopPromiseFn;
		}

		that.isPromise = function ( o ) {
			if ( o == null ) {
				return false;
			}

			if ( typeof o.then === 'function' ) {
				return true;
			}
			return false;
		}

		that.isRactiveObject = function ( o ) {
			if ( ( typeof o == "object" ) && ( o !== null ) ) {
				if ( o._guid != null ) {
					return true;
				}
				return false;
			}
			return false;
		}

		that.objectLength = function ( o ) {
			if ( Object.keys ) {
				return Object.keys( o ).length;
			}

			var count = 0;
			var prop;
			for ( prop in o ) {
				if ( o.hasOwnProperty( prop ) ) {
					count ++;
				}
			}
		};

		that.isObject = function ( obj ) {
			if ( ( typeof obj === "object" ) && ( obj !== null ) ) {
				return true;
			}
			return false;
		}

		that.populateError = function ( err, severity, options ) {

			if ( err instanceof Error || that.isObject( err ) ) {

				if ( err.options == null ) {
					err.options = options;
				}
				if ( err.severity == null ) {
					err.severity = severity;
				}
			}
		};

		that.logError = function ( err ) {

			if ( err == null )
				return;

			if ( ! mode.DEBUG )
				return;

			var isObj = that.isObject( err );

			if ( isObj ) {
				if ( err.severity == null ) {
					err.severity = severity.ERROR;
				}
			}

			var fn = getLogFn( err );

			if ( err.stack ) {
				fn( err.stack );
			} else {
				fn( err );
			}

			if ( isObj ) {
				for ( var item in err ) {
					fn( item, ":", err[item] );
				}
			}
		};

		function getLogFn( err ) {

			switch ( err.severity ) {

				case severity.DEBUG:
					return $log.log;

				case severity.WARN:
					return $log.warn;

				case severity.INFO:
					return $log.info;

				default:
					return $log.error;
			}
		}

		return that;
	}

	var utils = utils( );
	return utils;
} );