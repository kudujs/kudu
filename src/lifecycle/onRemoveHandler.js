define( function ( require ) {

	var utils = require( "../utils/utils" );
	var severity = require( "../utils/severity" );
	require( "../utils/jqr/npo" );

	function onRemoveHandler( options ) {

		var promise = new Promise( function ( resolve, reject ) {

			if ( typeof options.ctrl.onRemove !== 'function' ) {
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

			var booleanOrPromise = options.ctrl.onRemove( viewOptions );

			if ( booleanOrPromise == null || booleanOrPromise == true ) {
				resolve();
				return promise;
			}

			if ( booleanOrPromise == false ) {
				var err = new Error( "controller onRemove() returned false, view will not be switched!" );
				utils.populateError( err, severity.INFO, options );
				reject( err );
				return promise;
			}

			if ( utils.isPromise( booleanOrPromise ) ) {
				booleanOrPromise.then( function ( bool ) {

					// Request could have been overwritten by new request. Ensure this is still the active request
					if ( ! options.mvc.requestTracker.active ) {
						var err = new Error( "Request overwritten by another view request" );
						utils.populateError( err, severity.WARN, options );
						reject( err );
						return promise;
					}

					if ( bool == null || bool == true ) {
						resolve();
					} else {
						var err = new Error( "controller onRemove() returned a promise that resolved to, '" + bool + "', instead of 'true', view will not be switched!" );
						utils.populateError( err, severity.INFO, options );
						reject( err );
					}
				} ).catch( function ( err ) {
					// onRemove promise rejected
					utils.populateError( err, severity.ERROR, options );
					reject( err );
				} );

			} else {
				var err = new Error( "Ignoring new view since onRemove did not return a valid response. onRemove must return either true/false or a promise that resolves to true/false." );
				utils.populateError( err, severity.WARN, options );
				reject( err );
			}
		} );
		return promise;
	}

	return onRemoveHandler;
} );