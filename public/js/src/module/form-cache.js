/**
 * @preserve Copyright 2014 Martijn van de Rijdt & Harvard Humanitarian Initiative
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Deals with browser storage
 */

define( [ 'store', 'connection', 'q' ], function( store, connection, Q ) {
    "use strict";

    var hash;

    // DEBUG
    // window.store = store;

    function init( survey ) {
        return store.init()
            .then( function() {
                return get( survey );
            } )
            .then( function( result ) {
                var deferred = Q.defer();
                console.log( 'storage get result', result );
                if ( result ) {
                    deferred.resolve( result );
                    return deferred.promise;
                } else {
                    return set( survey );
                }
            } )
            .then( _setUpdateIntervals );
    }

    function get( survey ) {
        return store.getSurvey( survey.enketoId );
    }

    function set( survey ) {
        return connection.getFormParts( survey )
            .then( _swapMediaSrc )
            .then( store.setSurvey );
    }

    function remove( survey ) {
        return store.removeSurvey( survey.enketoId );
    }

    function update( survey ) {
        return store.updateSurvey( survey );
    }

    function _setUpdateIntervals( survey ) {
        var deferred = Q.defer();

        console.debug( 'setting update check intervals' );

        hash = survey.hash;

        // when it's pretty certain that the form has been rendered, check for form update
        setTimeout( function() {
            _updateCache( survey );
        }, 3 * 60 * 1000 );
        // check for form update every 20 minutes
        setInterval( function() {
            _updateCache( survey );
        }, 20 * 60 * 1000 );
        deferred.resolve( survey );
        return deferred.promise;
    }

    function _swapMediaSrc( survey ) {
        var deferred = Q.defer();

        survey.form = survey.form.replace( /(src=\"[^"]*\")/g, "data-offline-$1 src=\"\"" );
        deferred.resolve( survey );

        return deferred.promise;
    }

    function updateMedia( survey ) {
        var requests = [];

        // if survey.resources exists, the resource are available in the store
        if ( survey.resources ) {
            return _loadMedia( survey );
        }

        // download, store and load the resources
        console.debug( 'getting media' );

        survey.files = [];
        survey.resources = [];

        _getElementsGroupedBySrc( survey.$form ).forEach( function( elements ) {
            var src = elements[ 0 ].dataset.offlineSrc;
            survey.resources.push( src );
            requests.push( connection.getFile( src ) );
        } );

        return Q.all( requests )
            .then( function( resources ) {
                var deferred = Q.defer();

                resources.forEach( function( resource, index ) {
                    var url = survey.resources[ index ];

                    survey.files.push( {
                        url: url,
                        item: resource
                    } );
                } );
                deferred.resolve( survey );
                return deferred.promise;
            } )
            .then( store.updateSurvey )
            .then( _loadMedia );
    }

    function _loadMedia( survey ) {
        var resourceUrl,
            deferred = Q.defer(),
            URL = window.URL || window.webkitURL;

        console.debug( 'loading media from storage' );

        _getElementsGroupedBySrc( survey.$form ).forEach( function( elements ) {
            var src = elements[ 0 ].dataset.offlineSrc;

            store.getResource( survey.enketoId, src )
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

    function _getElementsGroupedBySrc( $form ) {
        var groupedElements = [],
            urls = {},
            $els = $form.find( '[data-offline-src]' );

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

    function _updateCache( survey ) {
        console.debug( 'checking for survey update' );

        connection.getFormPartsHash( survey )
            .then( function( version ) {
                if ( hash === version ) {
                    console.debug( 'Cached survey is up to date!' );
                } else {
                    console.debug( 'Cached survey is outdated! old:', hash, 'new:', version );
                    return connection.getFormParts( survey )
                        .then( function( formParts ) {
                            var deferred = Q.defer();
                            // media will be updated next time the form is loaded if resources is undefined
                            formParts.resources = undefined;
                            deferred.resolve( formParts );
                            return deferred.promise;
                        } )
                        .then( _swapMediaSrc )
                        .then( store.updateSurvey )
                        .then( function( result ) {
                            // set the hash so that subsequent update checks won't redownload the form
                            hash = result.hash;
                            // TODO notify user to refresh or trigger event on form
                            console.debug( 'Survey is now updated in the store. Need to refresh.' );
                        } );
                }
            } )
            .catch( function( error ) {
                // if the form has been de-activated or removed from the server
                if ( error.status === 404 ) {
                    // remove it from the store
                    remove( survey )
                        .then( function() {
                            // TODO notify user to refresh or trigger event on form
                            console.log( 'survey ' + survey.enketoId + ' removed from storage' );
                        } )
                        .catch( function( e ) {
                            console.error( 'an error occurred when attempting to remove the survey from storage', e );
                        } );
                } else {
                    console.log( 'Could not obtain latest survey or hash from server or failed to save it. Probably offline.', error.stack );
                }
            } );
    }

    /**
     * Completely flush the form cache (not the data storage)
     *
     * @return {Promise} [description]
     */
    function flush() {
        return store.flushTable( 'surveys' )
            .then( function() {
                store.flushTable( 'resources' );
            } )
            .then( function() {
                console.log( 'Done! The form cache is empty now.' );
                return;
            } );
    }

    return {
        init: init,
        get: get,
        set: set,
        update: update,
        updateMedia: updateMedia,
        remove: remove,
        flush: flush
    };

} );
