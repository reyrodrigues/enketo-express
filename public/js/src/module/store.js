/**
 * @preserve Copyright 2014 Martijn van de Rijdt
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

define( [ 'db', 'q' ], function( db, Q ) {
    "use strict";
    var server,
        databaseName = 'enketo';

    // TODO: test in old version of Safari and IE
    if ( typeof window.Promise === 'undefined' ) {
        window.Promise = Q.Promise;
    }

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
        var deferred = Q.defer();

        db
            .open( {
                server: databaseName,
                version: 0.1,
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
                    // Am putting records in separate table because it makes more sense for getting, updating and removing records
                    // if they are not stores in one (giant) array or object value.
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
                console.debug( 'WHoohoeeee, we\'ve got ourselves a database!', s );
                // throw new Error( 'weird error' );
                deferred.resolve( databaseName );
            } )
            .catch( function( e ) {
                console.error( e );
            } );

        return deferred.promise;
    }

    function isWriteable( dbName ) {
        return updateSetting( {
            name: 'lastLaunched',
            value: new Date().getTime()
        } );
    }

    function updateSetting( setting ) {
        return server.settings.update( setting );
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

    return {
        init: init,
        isWriteable: isWriteable,
        updateSetting: updateSetting,
        flush: flush
    };
} );
