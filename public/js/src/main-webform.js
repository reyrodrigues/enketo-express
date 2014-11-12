require( [ 'require-config' ], function( rc ) {
    "use strict";
    if ( console.time ) console.time( 'client loading time' );
    require( [ 'gui', 'controller-webform', 'settings', 'connection', 'enketo-js/FormModel', 'store', 'jquery' ],
        function( gui, controller, settings, connection, FormModel, store, $ ) {
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
                console.debug( 'in offline mode' );
                // TODO: is this condition actually possible?
                if ( !settings.enketoId ) {
                    var error = new Error( 'This view is not available as an offline-enabled view.' );
                    _showErrorOrAuthenticate( error );
                } else {
                    store.init()
                        //.then( store.isWriteable )
                        .fail( function( e ) {
                            console.error( e );
                            gui.alert( 'Browser storage is required but not available or not writeable. If you are in "private browsing" mode please switch to regular mode.', 'No Storage' );
                        } )
                        .then( function() {
                            return store.getForm( settings.enketoId );
                        } )
                        .then( function( result ) {
                            console.debug( 'found formparts in local database!', result );
                            if ( result.form && result.model ) {
                                _init( result.form, result.model, _prepareInstance( result.model, settings.defaults ) );
                            } else {
                                throw new Error( 'Form not complete.' );
                            }
                        } )
                        .catch( function( e ) {
                            console.log( 'Failed to get form parts from storage, will try to obtain from server.', e );
                            connection.getFormParts( survey )
                                .then( function( result ) {
                                    console.debug( 'result', result );
                                    if ( result.form && result.model ) {
                                        _init( result.form, result.model, _prepareInstance( result.model, settings.defaults ) );
                                        result[ 'id' ] = settings.enketoId;
                                        return store.setForm( result )
                                            .then( function() {
                                                console.debug( 'Form is now stored and available offline!' );
                                            } )
                                            .catch( _showErrorOrAuthenticate );
                                    } else {
                                        throw new Error( 'Form not complete.' );
                                    }
                                } )
                                .catch( _showErrorOrAuthenticate );
                        } );
                }
            } else {
                console.debug( 'in online mode' );
                connection.getFormParts( survey )
                    .then( function( result ) {
                        if ( result.form && result.model ) {
                            _init( result.form, result.model, _prepareInstance( result.model, settings.defaults ) );
                        } else {
                            throw new Error( 'Form not complete.' );
                        }
                    } )
                    .catch( _showErrorOrAuthenticate );
            }

            function _showErrorOrAuthenticate( error ) {
                console.log( 'error', error );
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

            function _init( formStr, modelStr, instanceStr ) {
                $loader[ 0 ].outerHTML = formStr;
                $( document ).ready( function() {
                    controller.init( 'form.or:eq(0)', modelStr, instanceStr );
                    $form.add( $buttons ).removeClass( 'hide' );
                    if ( console.timeEnd ) console.timeEnd( 'client loading time' );
                } );
            }
        } );
} );
