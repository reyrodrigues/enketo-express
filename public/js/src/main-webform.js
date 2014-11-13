require( [ 'require-config' ], function( rc ) {
    "use strict";
    if ( console.time ) console.time( 'client loading time' );
    require( [ 'gui', 'controller-webform', 'settings', 'connection', 'enketo-js/FormModel', 'store', 'q', 'jquery' ],
        function( gui, controller, settings, connection, FormModel, store, Q, $ ) {
            var $loader = $( '.form__loader' ),
                $form = $( 'form.or' ),
                $buttons = $( '.form-header__button--print, button#validate-form, button#submit-form' ),
                survey = {
                    enketoId: settings.enketoId,
                    serverUrl: settings.serverUrl,
                    xformId: settings.xformId,
                    xformUrl: settings.xformUrl,
                    defaults: settings.defaults
                };


            if ( settings.offline ) {
                var hash;
                console.debug( 'in offline mode' );
                // TODO: is this condition actually possible?
                if ( !settings.enketoId ) {
                    var error = new Error( 'This view is not available as an offline-enabled view.' );
                    _showErrorOrAuthenticate( error );
                } else {
                    store.init()
                        .then( function() {
                            return store.getForm( settings.enketoId );
                        } )
                        .then( function( formParts ) {
                            console.debug( 'found formparts in local database!' );
                            _init( formParts );
                        } )
                        .then( _setUpdateIntervals )
                        .catch( function( e ) {
                            console.debug( 'Failed to get form parts from storage, will try to obtain from server.', e );
                            if ( e.status !== 500 ) {
                                connection.getFormParts( survey )
                                    .then( _init )
                                    .then( store.setForm )
                                    .then( function() {
                                        console.debug( 'Form is now stored and available offline!' );
                                        // TODO store media + external data files
                                        // TODO show offline-capable icon in UI
                                    } )
                                    .then( setUpdateIntervals )
                                    .catch( _showErrorOrAuthenticate );
                            } else {
                                _showErrorOrAuthenticate( e );
                            }
                        } );
                }
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

            function _setUpdateIntervals() {
                var deferred = Q.defer();
                // when it's pretty certain that the form has been rendered, check for form update
                setTimeout( function() {
                    _updateCache( survey );
                }, 3 * 60 * 1000 );
                // check for form update every 20 minutes
                setInterval( function() {
                    _updateCache( survey );
                }, 20 * 60 * 1000 );
                deferrred.resolve( true );
                return deferred.promise;
            }

            function _updateCache( survey ) {
                console.debug( 'checking need for cache update' );
                connection.getFormPartsHash( survey )
                    .then( function( version ) {
                        if ( hash === version ) {
                            console.debug( 'Form is up to date!' );
                        } else {
                            console.debug( 'Form is outdated!', hash, version );
                            connection.getFormParts( survey )
                                .then( function( formParts ) {
                                    var deferred = Q.defer();
                                    hash = formParts.hash; // check if this is best location
                                    formParts[ 'id' ] = settings.enketoId;
                                    deferred.resolve( formParts );
                                    return deferred.promise;
                                } )
                                .then( store.updateForm )
                                .then( function() {
                                    console.debug( 'Form is now updated in the store. Need to refresh.' );
                                    // TODO notify user to refresh
                                } )
                                .catch( _showErrorOrAuthenticate );
                        }
                    } );
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
                var deferred = Q.defer();

                if ( formParts.form && formParts.model ) {
                    hash = formParts.hash;
                    formParts[ 'id' ] = settings.enketoId;
                    $loader[ 0 ].outerHTML = formParts.form;
                    $( document ).ready( function() {
                        controller.init( 'form.or:eq(0)', formParts.model, _prepareInstance( formParts.model, settings.defaults ) );
                        $form.add( $buttons ).removeClass( 'hide' );
                        if ( console.timeEnd ) console.timeEnd( 'client loading time' );
                        deferred.resolve( formParts );
                    } );
                } else {
                    deferred.reject( new Error( 'Form not complete.' ) );
                }
                return deferred.promise;
            }
        } );
} );
