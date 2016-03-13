define( function ( require ) {

	require( "../../utils/jqr/npo" );
	var utils = require( "../../utils/utils" );
	var jqutils = require( "../../utils/jqr/jqutils" );
	var severity = require( "../../utils/severity" );
	var router = require( "../../router/router" );

	function create( options ) {

		var promise = new Promise( function ( resolve, reject ) {

			if ( options.viewOrPromise == null ) {

				// No new view to render, so we aren't navigating away from current view. However hash already changed
				// so reset the hash to current view
				router.restorePreviousHash();

				var err = new Error( "Ignoring view since onInit returned null. onInit must return either a Ractive function or a promise that resolves to a Ractive function." );
				utils.populateError( err, severity.WARN, options );
				reject( err );
				return promise;
			}

			if ( utils.isPromise( options.viewOrPromise ) ) {

				options.viewOrPromise.then( function ( ractiveObj ) {

					if ( typeof ractiveObj === 'function' ) {
						ractiveObj = new ractiveObj();
					}

					// Request could have been overwritten by new request. Ensure this is still the active request
					if ( ! options.mvc.requestTracker.active ) {
						var err = new Error( "Request overwritten by another view request" );
						utils.populateError( err, severity.WARN, options );
						reject( err );
						return promise;
					}

					var view = ractiveObj;
					resolve( view );

				} ).catch( function ( err ) {
					if ( ! options.mvc.requestTracker.active && arguments.length === 0 ) {
						var newErr = new Error( "Request overwritten by another view request" );
						utils.populateError( newErr, severity.WARN, options );
						newErr.origError = err;
						reject( newErr );
					} else {
						// if the Ctrl.onInit() call rejected promise
						utils.populateError( newErr, severity.ERROR, options );
						reject( err );

					}

				} );

			} else if ( jqutils.isFunction( options.viewOrPromise ) ) {
				// Assume it is a Ractive function
				// Should this scenrio be supported? How will the view receive an instance to the ractive
				//options.kudu.createRactive(RactiveFnOrPromise);
				var view = new options.viewOrPromise();
				resolve( view );

			} else if ( utils.isRactiveObject( options.viewOrPromise ) ) {
				// Assume it is a Ractive instance
				var view = options.viewOrPromise;
				resolve( view );

			} else {
				var err = new Error( "Ignoring view since onInit did not return a valid response. onInit must return either a Ractive function or a promise that resolves to a Ractive function." );
				utils.populateError( err, severity.WARN, options );
				reject( err );
			}
		} );

		return promise;
	}

	return create;
} );