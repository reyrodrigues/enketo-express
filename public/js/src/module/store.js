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
                            keyPath: 'enketoId',
                            autoIncrement: false
                        },
                        indexes: {
                            enketoId: {
                                unique: true
                            }
                        }
                    },
                    // the resources that belong to a form
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
                            keyPath: 'instanceId',
                        },
                        indexes: {
                            name: {
                                unique: true
                            },
                            instanceId: {
                                unique: true
                            }
                        }
                    },
                    // the files that belong to a record
                    files: {
                        key: {
                            autoIncrement: false
                        },
                        indexes: {
                            key: {
                                unique: true
                            }
                        }
                    },
                    properties: {
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
                console.debug( 'WHoohoeeee, we\'ve got ourselves a database! Now let\'s check if it works properly.' );
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
        return updateProperty( {
            name: 'testWrite',
            value: new Date().getTime()
        } );
    }

    // detect older indexedDb implementations that do not support storing blobs properly (e.g. Safari 7 and 8)
    function _canStoreBlobs() {
        var aBlob = new Blob( [ '<a id="a"><b id="b">hey!</b></a>' ], {
            type: 'text/xml'
        } );
        return updateProperty( {
            name: 'testBlobWrite',
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

    function updateProperty( property ) {
        return server.properties.update( property )
            .then( _firstItemOnly );
    }

    function getProperty( name ) {
        return server.properties.get( name )
            .then( _firstItemOnly );
    }

    /** 
     * Obtains a single survey's form HTML and XML model from storage
     * @param  {[type]} id [description]
     * @return {[type]}    [description]
     */
    function getSurvey( id ) {
        console.debug( 'attempting to obtain survey from storage', id );
        return server.surveys.get( id )
            .then( _firstItemOnly );
    }

    /**
     * Db.js get and update functions return arrays. This function extracts the first item of the array
     * and passed it along.
     *
     * @param  {<*>} array Array of retrieve database items.
     * @return {Promise}       [description]
     */
    function _firstItemOnly( results ) {
        var deferred = Q.defer();

        if ( Object.prototype.toString.call( results ) === '[object Array]' ) {
            // if an array
            deferred.resolve( results[ 0 ] );
        } else {
            // if not an array
            deferred.resolve( results );
        }

        return deferred.promise;
    }

    /**
     * Stores a single survey's form HTML and XML model
     *
     * @param {[type]} survey [description]
     * @return {Promise}        [description]
     */
    function setSurvey( survey ) {
        console.debug( 'attempting to store new survey' );
        if ( !survey.form || !survey.model || !survey.enketoId || !survey.hash ) {
            throw new Error( 'Survey not complete' );
        }
        return server.surveys.add( survey )
            .then( _firstItemOnly );
    }

    /**
     * Removes survey form and all its resources
     *
     * @param  {[type]} id [description]
     * @return {Promise}    [description]
     */
    function removeSurvey( id ) {
        var resources,
            tasks = [];

        return getSurvey( id )
            .then( function( survey ) {
                console.debug( 'survey found', survey );
                resources = survey.resources || [];
                resources.forEach( function( resource ) {
                    console.debug( 'adding removal of ', resource, 'to remove task queue' );
                    tasks.push( removeResource( id, resource ) );
                } );
                tasks.push( server.surveys.remove( id ) );
                return Q.all( tasks );
            } );
    }

    /**
     * Updates a single survey's form HTML and XML model as well any external resources belonging to the form
     *
     * @param  {[type]} survey [description]
     * @return {Promise}        [description]
     */
    function updateSurvey( survey ) {
        console.debug( 'attempting to update stored survey' );
        if ( !survey.form || !survey.model || !survey.enketoId ) {
            throw new Error( 'Survey not complete' );
        }
        return server.surveys.update( {
                form: survey.form,
                model: survey.model,
                enketoId: survey.enketoId,
                hash: survey.hash,
                resources: survey.resources
            } )
            .then( function() {
                var tasks = [];

                survey.files = survey.files || [];

                survey.files.forEach( function( file ) {
                    tasks.push( updateResource( survey.enketoId, file ) );
                } );

                return Q.all( tasks )
                    .then( function() {
                        var deferred = Q.defer();
                        // resolving with original survey (not the array returned by server.surveys.update)
                        deferred.resolve( survey );
                        return deferred.promise;
                    } );
            } );
    }

    /** 
     * Obtains a single record (XML + files)
     *
     * @param  {[type]} record [description]
     * @return {Promise}        [description]
     */
    function getRecord( instanceId ) {
        return server.records.get( instanceId )
            .then( _firstItemOnly )
            .then( function( record ) {
                var fileKey,
                    tasks = [];

                record.files.forEach( function( fileKey ) {
                    tasks.push( getRecordFile( record.instanceId, fileKey ) );
                } );

                return Q.all( tasks )
                    .then( function( files ) {
                        record.files = files;
                        return record;
                    } );
            } );
    }

    /**
     * Sets a new single record (XML + files)
     *
     * @param {[type]} record [description]
     * @return {Promise}        [description]
     */
    function setRecord( record ) {
        var fileKeys;

        console.debug( 'attempting to store new record' );

        //var deferred = Q.defer();
        // deferred.reject( new Error( 'record setting error' ) );
        //return deferred.promise;

        if ( !record.instanceId || !record.name || !record.xml ) {
            throw new Error( 'Record not complete' );
        }

        record.files = record.files || [];

        // build array of file keys
        fileKeys = record.files.map( function( file ) {
            return file.key;
        } );

        return server.records.add( {
                instanceId: record.instanceId,
                name: record.name,
                xml: record.xml,
                files: fileKeys,
                updated: new Date().getTime(),
                draft: record.draft
            } )
            .then( function() {
                var tasks = [];

                record.files.forEach( function( file ) {
                    //file.key = record.instanceId + ':' + file.key;
                    tasks.push( updateRecordFile( record.instanceId, file ) );
                } );

                return Q.all( tasks )
                    .then( function() {
                        //var deferred = Q.defer();
                        // resolving with original record (not the array returned by server.records.add)
                        //deferred.resolve( record );
                        //return deferred.promise;
                        return record;
                    } );
            } );
    }

    /**
     * Updates (or creates) a single record (XML + files)
     *
     * @param {[type]} record [description]
     * @return {Promise}        [description]
     */
    function updateRecord( record ) {
        var fileKeys;

        console.debug( 'attempting to update a stored record' );

        if ( !record.instanceId || !record.name || !record.xml ) {
            throw new Error( 'Record not complete' );
        }

        record.files = record.files || [];

        // build array of file keys
        fileKeys = record.files.map( function( file ) {
            return file.key;
        } );
        return server.records.update( {
                instanceId: record.instanceId,
                name: record.name,
                xml: record.xml,
                files: fileKeys,
                updated: new Date().getTime(),
                draft: record.draft
            } )
            .then( function() {
                var tasks = [];

                record.files.forEach( function( file ) {
                    tasks.push( updateRecordFile( record.instanceId, file ) );
                } );

                return Q.all( tasks )
                    .then( function() {
                        var deferred = Q.defer();
                        // resolving with original survey (not the array returned by server.records.update)
                        deferred.resolve( record );
                        return deferred.promise;
                    } );
            } );
    }

    /** 
     * Removes a single record (XML + files)
     *
     * @param {[type]} record [description]
     * @return {Promise}        [description]
     */
    function removeRecord( instanceId ) {
        var files,
            tasks = [];

        return getRecord( instanceId )
            .then( function( record ) {
                console.debug( 'record, found', record );
                files = record.files || [];
                files.forEach( function( fileKey ) {
                    console.debug( 'adding removal of ', fileKey, 'to remove task queue' );
                    tasks.push( removeRecordFile( instanceId, fileKey ) );
                } );
                tasks.push( server.records.remove( instanceId ) );
                return Q.all( tasks );
            } );
    }

    /**
     * Updates an external resource in storage or creates it if it does not yet exist. This function is exported
     * for testing purposes, but not actually used as a public function in Enketo.
     *
     * @param  {{item:Blob, url:string}} resource
     * @return {[type]}          [description]
     */
    function updateResource( id, resource ) {
        var deferred, error;

        console.log( 'updating resource', id, JSON.stringify( resource ), 'to be encoded', blobEncoding );

        if ( id && resource && resource.item instanceof Blob && resource.url ) {
            resource.key = id + ':' + resource.url;
            delete resource.url;
            if ( blobEncoding ) {
                /*
                 * IE doesn't like complex objects with Blob properties so we store the blob as the value.
                 * The files table does not have a keyPath for this reason.
                 * The format of file (item: Blob, key: string) is db.js way of directing
                 * it to store the blob instance as the value.
                 */
                return utils.blobToDataUri( resource.item )
                    .then( function( convertedBlob ) {
                        resource.item = convertedBlob;
                        return server.resources.update( resource );
                    } );
            } else {
                return server.resources.update( resource );
            }
        } else {
            deferred = Q.defer();
            error = new Error( 'DataError. File not complete or enketoId not provided.' );
            error.name = 'DataError';
            deferred.reject( error );
            return deferred.promise;
        }

    }

    function getResource( id, url ) {
        return _getFile( 'resources', id, url );
    }

    function removeResource( id, url ) {
        return server.resources.remove( id + ':' + url );
    }

    /**
     * Updates an file belonging to a record in storage or creates it if it does not yet exist. This function is exported
     * for testing purposes, but not actually used as a public function in Enketo.
     *
     * @param  {{item:Blob, name:string}} file The key consist of a concatenation of the id, _, and the URL
     * @return {[type]}          [description]
     */
    function updateRecordFile( instanceId, file ) {
        var deferred, error;

        console.debug( 'adding record file to db', instanceId, file );

        if ( instanceId && file && file.item instanceof Blob && file.name ) {
            file.key = instanceId + ':' + file.name;
            delete file.name;
            /*
             * IE doesn't like complex objects with Blob properties so we store the blob as the value.
             * The files table does not have a keyPath for this reason.
             * The format of file (item: Blob, key: string) is db.js way of directing
             * it to store the blob instance as the value.
             */
            if ( blobEncoding ) {
                return utils.blobToDataUri( file.item )
                    .then( function( convertedBlob ) {
                        file.item = convertedBlob;
                        return server.files.update( file );
                    } );
            } else {
                return server.files.update( file );
            }
        } else {
            deferred = Q.defer();
            error = new Error( 'DataError. File not complete or instanceId not provided.' );
            error.name = 'DataError';
            deferred.reject( error );
            return deferred.promise;
        }

    }

    function getRecordFile( instanceId, fileKey ) {
        return _getFile( 'files', instanceId, fileKey );
    }

    function _getFile( table, id, key ) {
        var prop,
            file = {},
            deferred = Q.defer();

        if ( table === 'resources' || table === 'files' ) {
            prop = ( table === 'resources' ) ? 'url' : 'name';
            server[ table ].get( id + ':' + key )
                .then( function( item ) {
                    file[ prop ] = key;
                    if ( item instanceof Blob ) {
                        file.item = item;
                        deferred.resolve( file );
                    } else if ( typeof item === 'string' ) {
                        utils.dataUriToBlob( item )
                            .then( function( item ) {
                                file.item = item;
                                deferred.resolve( file );
                            } );
                    } else {
                        // if item is falsy or unexpected
                        deferred.resolve( undefined );
                    }
                } )
                .catch( deferred.reject );
        } else {
            deferred.reject( new Error( 'Unknown table or issing id or key.' ) );
        }

        return deferred.promise;
    }

    /**
     * Removes a record file
     *
     * @param  {string} instanceId [description]
     * @return {Promise}            [description]
     */
    function removeRecordFile( instanceId, fileKey ) {
        return server.files.remove( instanceId + ':' + fileKey );
    }

    // completely remove the database
    // there is no db.js method for this yet
    function flush() {
        var request,
            deferred = Q.defer();

        try {
            server.close( databaseName );
        } catch ( e ) {
            console.log( 'Database has probably been removed already. Doing nothing.', e );
            deferred.resolve();
            return deferred.promise;
        }

        request = indexedDB.deleteDatabase( databaseName );

        request.onsuccess = function() {
            console.log( "Deleted database successfully" );
            deferred.resolve();
        };
        request.onerror = function( error ) {
            deferred.reject( error );
        };
        request.onblocked = function( error ) {
            deferred.reject( error );
        };

        return deferred.promise;
    }

    /**
     * Removes a table from the store
     *
     * @param  {string} table [description]
     * @return {Promise}       [description]
     */
    function flushTable( table ) {
        return server[ table ].clear();
    }

    // debugging utilities: should move elsewehere or be turned into useful functions that return promises
    var dump = {
        resources: function() {
            server.resources
                .query()
                .all()
                .execute()
                .done( function( results ) {
                    console.log( results.length + ' resources found' );
                    results.forEach( function( item ) {
                        if ( item instanceof Blob ) {
                            console.log( item.type, item.size, URL.createObjectURL( item ) );
                        } else {
                            console.log( 'resource string with length ', item.length, 'found' );
                        }
                    } );
                } );
        },
        surveys: function() {
            server.surveys
                .query()
                .all()
                .execute()
                .done( function( results ) {
                    console.log( results.length + ' surveys found' );
                    results.forEach( function( item ) {
                        console.log( 'survey', item );
                    } );
                } );
        },
        records: function() {

        }
    };

    return {
        init: init,
        getProperty: getProperty,
        updateProperty: updateProperty,
        flush: flush,
        flushTable: flushTable,
        getSurvey: getSurvey,
        setSurvey: setSurvey,
        updateSurvey: updateSurvey,
        removeSurvey: removeSurvey,
        getRecord: getRecord,
        setRecord: setRecord,
        updateRecord: updateRecord,
        removeRecord: removeRecord,
        getResource: getResource,
        updateResource: updateResource,
        getRecordFile: getRecordFile,
        updateRecordFile: updateRecordFile,
        dump: dump
    };

} );
