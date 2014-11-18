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
                        .then( _init )
                        .then( _loadMedia ) // or should this be a part of init?
                        .then( _setUpdateIntervals )
                        .catch( function( e ) {

                            if ( e.status === 404 || e.status === 400 ) {
                                console.debug( 'Failed to get form parts from storage, will try to obtain from server.', e, e.stack );
                                connection.getFormParts( survey )
                                    .then( _swapMediaSrc )
                                    .then( _init )
                                    .then( store.setForm )
                                    .then( _getMedia )
                                    .then( _loadMedia )
                                    .then( store.updateForm )
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

            function _swapMediaSrc( survey ) {
                var deferred = Q.defer();

                survey.form = survey.form.replace( /(src=\"[^"]*\")/g, "data-offline-$1 src=\"\"" );
                deferred.resolve( survey );

                return deferred.promise;
            }

            function _getMedia( survey ) {
                var deferred = Q.defer(),
                    requests = [],
                    urls = [],
                    $fileResources;


                // survey has become an array after setForm!!
                survey = survey[ 0 ];
                survey.files = {};

                $fileResources = $( 'form.or [src]' ).each( function() {
                    //console.debug( '$el', this );
                    //console.debug( 'src', this.dataset.offlineSrc );
                    var src = this.dataset.offlineSrc;
                    // in Safari the widgets form finds on element with src = undefined
                    if ( survey.files[ src ] === undefined && src ) {
                        survey.files[ src ] = null;
                        urls.push( src );
                        requests.push( connection.getFile( src ) );
                    }
                } );

                console.debug( 'urls to retrieve', urls );

                Q.all( requests )
                    .then( function( resources ) {
                        resources.forEach( function( resource, index ) {
                            var url = urls[ index ];
                            survey.files[ url ] = resource;
                        } );
                        deferred.resolve( survey );
                    } )
                    .catch( deferred.reject );

                return deferred.promise;

            }

            function _loadMedia( survey ) {
                var $targets, resourceUrl,
                    deferred = Q.defer(),
                    URL = window.URL || window.webkitURL;

                console.debug( 'loading media into form', survey.files );

                for ( var file in survey.files ) {
                    if ( survey.files.hasOwnProperty( file ) ) {

                        // TODO any error (non-existing variable called) is swallowed!!
                        $targets = $( 'form.or [data-offline-src="' + file + '"]' );
                        console.debug( 'target length', $targets.length );
                        console.debug( 'blob', survey.files[ file ] );

                        resourceUrl = URL.createObjectURL( survey.files[ file ] );
                        console.log( 'resourceURL', resourceUrl );
                        $( $targets[ $targets.length - 1 ] ).one( 'load', function() {
                            //console.log( 'revoking object URL to free up memory' );
                            URL.revokeObjectURL( resourceUrl );
                        } );
                        $targets.attr( 'src', resourceUrl );
                    }
                }
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
