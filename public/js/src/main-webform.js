require( [ 'require-config' ], function( rc ) {
    "use strict";
    if ( console.time ) console.time( 'client loading time' );
    require( [ 'gui', 'controller-webform', 'settings', 'connection', 'enketo-js/FormModel', 'translator', 'jquery' ],
        function( gui, controller, settings, connection, FormModel, t, $ ) {
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

            connection.getFormParts( survey )
                .then( function( result ) {
                    if ( result.form && result.model ) {
                        gui.swapTheme( result.theme || _getThemeFromFormStr( result.form ) )
                            .then( function() {
                                _init( result.form, result.model, _prepareInstance( result.model, settings.defaults ) );
                            } );
                    } else {
                        throw new Error( 'Received form incomplete' );
                    }
                } )
                .catch( _showErrorOrAuthenticate );

            function _showErrorOrAuthenticate( error ) {
                $loader.addClass( 'fail' );
                if ( error.status === 401 ) {
                    window.location.href = '/login?return_url=' + encodeURIComponent( window.location.href );
                } else {
                    gui.alert( error.message, t( 'alert.loaderror.heading' ) );
                }
            }

            // TODO: move to utils.js after merging offline features
            function _getThemeFromFormStr( formStr ) {
                var matches = formStr.match( /<\s?form .*theme-([A-z]+)/ );
                return ( matches && matches.length > 1 ) ? matches[ 1 ] : null;
            }

            // TODO: move to utils.js after merging offline features
            function _getTitleFromFormStr( formStr ) {
                var matches = formStr.match( /<\s?h3 id="form-title">([A-z\s]+)</ );
                return ( matches && matches.length > 1 ) ? matches[ 1 ] : null;
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
                    $( 'head>title' ).text( _getTitleFromFormStr( formStr ) );
                    if ( console.timeEnd ) console.timeEnd( 'client loading time' );
                } );
            }
        } );
} );
