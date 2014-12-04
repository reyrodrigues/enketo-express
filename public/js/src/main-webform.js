require( [ 'require-config' ], function( rc ) {
    "use strict";
    if ( console.time ) console.time( 'client loading time' );
    require( [ 'gui', 'controller-webform', 'settings', 'connection', 'enketo-js/FormModel', 'form-cache', 'q', 'jquery' ],
        function( gui, controller, settings, connection, FormModel, formCache, Q, $ ) {
            var $loader = $( '.form__loader' ),
                $buttons = $( '.form-header__button--print, button#validate-form, button#submit-form' ),
                survey = {
                    enketoId: settings.enketoId,
                    serverUrl: settings.serverUrl,
                    xformId: settings.xformId,
                    xformUrl: settings.xformUrl,
                    defaults: settings.defaults
                };

            // DEBUG
            window.formCache = formCache;

            if ( settings.offline ) {
                console.debug( 'in offline mode' );
                formCache.init( survey )
                    .then( _init )
                    .then( formCache.updateMedia )
                    .then( function( s ) {
                        console.debug( 'Form is now stored and available offline!' );
                        // TODO show offline-capable icon in UI
                    } )
                    .catch( _showErrorOrAuthenticate );
            } else {
                console.debug( 'in online mode' );
                connection.getFormParts( survey )
                    .then( _init )
                    .catch( _showErrorOrAuthenticate );
            }

            function _showErrorOrAuthenticate( error ) {
                error = ( typeof error === 'string' ) ? new Error( error ) : error;
                console.log( 'error', error, error.stack );
                $loader.addClass( 'fail' );
                if ( error.status === 401 ) {
                    window.location.href = '/login?return_url=' + encodeURIComponent( window.location.href );
                } else {
                    gui.alert( error.message, 'Something went wrong' );
                }
            }

            function _prepareInstance( modelStr, defaults ) {
                var model, init,
                    existingInstance = null;

                for ( var path in defaults ) {
                    // TODO full:false support still needs to be added to FormModel.js
                    model = model || new FormModel( modelStr, {
                        full: false
                    } );
                    init = init || model.init();
                    if ( defaults.hasOwnProperty( path ) ) {
                        // if this fails, the FormModel will output a console error and ignore the instruction
                        model.node( path ).setVal( defaults[ path ] );
                    }
                    // TODO would be good to not include nodes that weren't in the defaults parameter
                    // TODO would be good to just pass model along instead of converting to string first
                    existingInstance = model.getStr();
                }
                return existingInstance;
            }

            function _init( formParts ) {
                var error, $form,
                    deferred = Q.defer();

                if ( formParts && formParts.form && formParts.model ) {
                    $loader[ 0 ].outerHTML = formParts.form;
                    $form = $( 'form.or:eq(0)' );

                    $( document ).ready( function() {
                        // TODO pass $form as first parameter?
                        controller.init( 'form.or:eq(0)', formParts.model, _prepareInstance( formParts.model, settings.defaults ) );
                        $form.add( $buttons ).removeClass( 'hide' );
                        if ( console.timeEnd ) console.timeEnd( 'client loading time' );

                        formParts.$form = $form;
                        deferred.resolve( formParts );
                    } );
                } else if ( formParts ) {
                    error = new Error( 'Form not complete.' );
                    errors.status = 400;
                    deferred.reject( error );
                } else {
                    error = new Error( 'Form not found' );
                    error.status = 404;
                    deferred.reject( error );
                }
                return deferred.promise;
            }
        } );
} );
