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
                            return store.getSurvey( settings.enketoId );
                        } )
                        .then( _init )
                        .then( _loadMedia ) // or should this be a part of init?
                        .then( _setUpdateIntervals )
                        .catch( function( e ) {

                            if ( e.status === 404 || e.status === 400 ) {
                                console.debug( 'Failed to get form parts from storage, will try to obtain from server.', e, e.stack );
                                connection.getFormParts( survey )
                                    .then( _swapMediaSrc )
                                    .then( _init )
                                    .then( store.setSurvey )
                                    .then( _getMedia )
                                    .then( store.updateSurvey )
                                    .then( _loadMedia )
                                    .then( function( s ) {
                                        console.debug( 'Form is now stored and available offline!', s );
                                        // TODO store media + external data files
                                        // TODO show offline-capable icon in UI
                                    } )
                                    .then( _setUpdateIntervals )
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

                console.debug( 'setting update check intervals' );
                // when it's pretty certain that the form has been rendered, check for form update
                setTimeout( function() {
                    _updateCache( survey );
                }, 3 * 60 * 1000 );
                // check for form update every 20 minutes
                setInterval( function() {
                    _updateCache( survey );
                }, 20 * 60 * 1000 );
                deferred.resolve( true );
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
                                .then( _getMedia )
                                .then( store.updateSurvey )
                                .then( function() {
                                    console.debug( 'Form is now updated in the store. Need to refresh.' );
                                    // TODO notify user to refresh
                                } )
                                .catch( _showErrorOrAuthenticate );
                        }
                    } )
                    .catch( function( error ) {
                        console.log( 'Could not obtain latest survey hash from server. Probably offline.' );
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

            function _swapMediaSrc( survey ) {
                var deferred = Q.defer();

                survey.form = survey.form.replace( /(src=\"[^"]*\")/g, "data-offline-$1 src=\"\"" );
                deferred.resolve( survey );

                return deferred.promise;
            }

            function _getMedia( survey ) {
                var deferred = Q.defer(),
                    requests = [];

                survey.files = [];
                survey.resources = [];

                _getElementsGroupedBySrc().forEach( function( elements ) {
                    var src = elements[ 0 ].dataset.offlineSrc;
                    survey.resources.push( src );
                    requests.push( connection.getFile( src ) );
                } );

                console.debug( 'urls to retrieve', survey.resources );

                Q.all( requests )
                    .then( function( resources ) {
                        resources.forEach( function( resource, index ) {
                            var url = survey.resources[ index ];

                            survey.files.push( {
                                key: url,
                                item: resource
                            } );
                        } );
                        deferred.resolve( survey );
                    } )
                    .catch( deferred.reject );

                return deferred.promise;
            }

            function _getElementsGroupedBySrc() {
                var groupedElements = [],
                    urls = {},
                    $els = $( 'form.or [data-offline-src]' );

                $els.each( function() {
                    if ( !urls[ this.dataset.offlineSrc ] ) {
                        var src = this.dataset.offlineSrc,
                            $group = $els.filter( function() {
                                if ( this.dataset.offlineSrc === src ) {
                                    // remove from $els to improve performance
                                    $els = $els.not( '[data-offline-src="' + src + '"]' );
                                    return true;
                                }
                            } );

                        urls[ src ] = true;
                        groupedElements.push( $.makeArray( $group ) );
                    }
                } );

                return groupedElements;
            }

            function _loadMedia( survey ) {
                var resourceUrl,
                    deferred = Q.defer(),
                    URL = window.URL || window.webkitURL;

                _getElementsGroupedBySrc().forEach( function( elements ) {
                    var src = elements[ 0 ].dataset.offlineSrc;

                    store.getResource( survey.id, src )
                        .then( function( resource ) {
                            // var srcUsedInsideRepeat;
                            // create a resourceURL
                            resourceUrl = URL.createObjectURL( resource );
                            // add this resourceURL as the src for all elements in the group
                            elements.forEach( function( element ) {
                                element.src = resourceUrl;
                                // srcUsedInsideRepeat = srcUsedInsideRepeat || $(element).closest('.or-repeat').length > 0;
                            } );
                        } );
                } );

                // TODO: revoke objectURL if not inside a repeat
                // add eventhandler to last element in a group?
                // $( element ).one( 'load', function() {
                //    console.log( 'revoking object URL to free up memory' );
                //    URL.revokeObjectURL( resourceUrl );
                // } );

                deferred.resolve( survey );
                return deferred.promise;
            }


            function _init( formParts ) {
                var $fileResources, error,
                    deferred = Q.defer();

                if ( formParts && formParts.form && formParts.model ) {
                    hash = formParts.hash;
                    formParts[ 'id' ] = settings.enketoId;
                    $loader[ 0 ].outerHTML = formParts.form;

                    $( document ).ready( function() {
                        controller.init( 'form.or:eq(0)', formParts.model, _prepareInstance( formParts.model, settings.defaults ) );
                        $form.add( $buttons ).removeClass( 'hide' );
                        if ( console.timeEnd ) console.timeEnd( 'client loading time' );
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
