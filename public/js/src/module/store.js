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

define( [ 'db', 'q', 'utils' ], function( db, Q, utils ) {
    "use strict";
    var server, blobEncoding,
        databaseName = 'enketo';

    /*
    record:
        instanceName( string, indexed, unique for id)
        //id (string indexed, not unique)
        lastSaved( number )
        record( xml )
        draft( boolean )
        files( blobs with property name: filename )

    survey:
        id (string, indexed, key, unique)
        form (html)
        model (xml)
        version (string)
        media (blobs with property name: full file path)
        extData 
    */

    function init() {
        return db.open( {
                server: databaseName,
                version: 1,
                schema: {
                    surveys: {
                        key: {
                            keyPath: 'id',
                            autoIncrement: false
                        },
                        indexes: {
                            id: {
                                unique: true
                            }
                        }
                    },
                    resources: {
                        key: {
                            autoIncrement: false
                        },
                        indexes: {
                            key: {
                                unique: true
                            }
                        }
                    },
                    // Am putting records in separate table because it makes more sense for getting, updating and removing records
                    // if they are not stored in one (giant) array or object value.
                    // Need to watch out for bad iOS bug: http://www.raymondcamden.com/2014/9/25/IndexedDB-on-iOS-8--Broken-Bad
                    // but with the current keys there is no risk of using the same key in multiple tables.
                    // Am choosing instanceId as the key because instanceName may change when editing a draft.
                    records: {
                        key: {
                            keyPath: [ 'instanceId' ],
                        },
                        indexes: {
                            instanceName: {
                                unique: true
                            },
                            id: {}
                        }
                    },
                    settings: {
                        key: {
                            keyPath: 'name',
                            autoIncrement: false
                        },
                        indexes: {
                            key: {
                                unique: true
                            }
                        }
                    }
                }
            } )
            .then( function( s ) {
                server = s;
                console.debug( 'WHoohoeeee, we\'ve got ourselves a database! Now let\'s check if it works properly.', s );
            } )
            .then( _isWriteable )
            .then( _setBlobStorageEncoding )
            .catch( function( e ) {
                // make error more useful and throw it further down the line
                var error = new Error( 'Browser storage is required but not available, corrupted, or not writeable. ' +
                    'If you are in "private browsing" mode please switch to regular mode, otherwise switch to another browser. (error: ' + e.message + ')' );
                error.status = 500;
                throw error;
            } );
    }

    function _isWriteable( dbName ) {
        return updateSetting( {
            name: 'lastLaunched',
            value: new Date().getTime()
        } );
    }

    // detect older indexedDb implementations that do not support storing blobs properly (e.g. Safari 7 and 8)
    function _canStoreBlobs() {
        var aBlob = new Blob( [ '<a id="a"><b id="b">hey!</b></a>' ], {
            type: 'text/xml'
        } );
        return updateSetting( {
            name: 'testBlob',
            value: aBlob
        } );
    }

    function _setBlobStorageEncoding() {
        var deferred = Q.defer();

        _canStoreBlobs()
            .then( function( blobsSupported ) {
                console.debug( 'This browser is able to store blobs directly' );
                blobEncoding = false;
            } )
            .catch( function() {
                console.debug( 'This browser is not able to store blobs directly, so blobs will be Base64 encoded' );
                blobEncoding = true;
            } )
            .then( function() {
                deferred.resolve();
            } );

        return deferred.promise;
    }

    function updateSetting( setting ) {
        return server.settings.update( setting );
    }

    /** 
     * Obtains the form HTML and XML model from storage
     * @param  {[type]} id [description]
     * @return {[type]}    [description]
     */
    function getForm( id ) {
        console.debug( 'attempting to obtain survey from storage', id );
        return server.surveys.get( id );
    }

    /**
     * Stores the form HTML and XML model
     *
     * @param {[type]} survey [description]
     * @return {Promise}        [description]
     */
    function setForm( survey ) {
        console.debug( 'attempting to store new survey', survey );
        if ( !survey.form || !survey.model || !survey.id ) {
            throw new Error( 'Survey not complete' );
        }
        return server.surveys.add( survey );

        // TODO: this resolves with array with length 1, Probably better to resolve with survey[0]
    }

    /**
     * Removes form and all the form resources
     *
     * @param  {[type]} id [description]
     * @return {Promise}    [description]
     */
    function removeForm( id ) {

    }

    /**
     * Updates the form HTML and XML model as well any external resources belonging to the form
     *
     * @param  {[type]} survey [description]
     * @return {Promise}        [description]
     */
    function updateForm( survey ) {
        console.debug( 'attempting to update stored survey', survey );
        if ( !survey.form || !survey.model || !survey.id ) {
            throw new Error( 'Survey not complete' );
        }
        return server.surveys.update( {
                form: survey.form,
                model: survey.model,
                id: survey.id,
                hash: survey.hash
            } )
            .then( function() {
                var tasks = [];

                survey.files = survey.files || [];
                console.debug( 'survey', survey );
                survey.files.forEach( function( file ) {
                    file.key = survey.id + '_' + file.key;
                    tasks.push( updateResource( file ) );
                } );

                return Q.all( tasks )
                    .then( function() {
                        var deferred = Q.defer();
                        // resolving with original survey (not the array returned by server.surveys.update)
                        deferred.resolve( survey );
                        return deferred.promise;
                    } );

                //TODO: better to resolve with survey object for consistency?
            } );
    }

    /**
     * Updates an external resource in storage or creates it if it does not yet exist
     *
     * @param  {{item:Blob, key:string}} resource The key consist of a concatenation of the id, _, and the URL
     * @return {[type]}          [description]
     */
    function updateResource( resource ) {
        // The format of resource is db.js way of directing it to store the blob instance as the value
        // The resources table does not have a keyPath for this reason
        // (IE doesn't like complex objects with Blob properties)
        if ( blobEncoding ) {
            return utils.blobToDataUri( resource.item )
                .then( function( convertedBlob ) {
                    resource.item = convertedBlob;
                    return server.resources.update( resource );
                } );
        } else {
            return server.resources.update( resource );
        }
    }

    function getResource( id, url ) {
        var deferred = Q.defer();

        server.resources.get( id + '_' + url )
            .then( function( item ) {
                if ( item instanceof Blob ) {
                    deferred.resolve( item );
                } else {
                    utils.dataUritoBlob( item ).then( deferred.resolve );
                }
            } );

        return deferred.promise;
    }

    // completely remove the database
    // there is no db.js method for this yet
    function flush() {
        var request,
            deferred = Q.defer();

        if ( server ) {
            server.close( databaseName );
        }

        request = indexedDB.deleteDatabase( databaseName );

        request.onsuccess = function() {
            console.log( "Deleted database successfully" );
            deferred.resolve( databaseName );
        };
        request.onerror = function( error ) {
            deferred.reject( error );
        };
        request.onblocked = function( error ) {
            deferred.reject( error );
        };
    }

    function logResources() {
        server.resources
            .query()
            .all()
            .execute()
            .done( function( results ) {
                console.log( results.length + ' resources found' );
                results.forEach( function( item ) {
                    console.log( item.type, item.size, URL.createObjectURL( item ) );
                } );
            } );
    }

    return {
        init: init,
        updateSetting: updateSetting,
        flush: flush,
        getForm: getForm,
        setForm: setForm,
        updateForm: updateForm,
        getResource: getResource,
        logResources: logResources
    };

} );
