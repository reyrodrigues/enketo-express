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

define( [ 'store', 'connection', 'q', 'settings', 'translator' ], function( store, connection, Q, settings, t ) {
    "use strict";

    var $exportButton, $uploadButton, $recordList, $queueNumber, uploadProgress,
        uploadOngoing = false;

    // DEBUG
    // window.store = store;

    function init() {
        ////_setUploadIntervals();
        // _setEventHandlers();

        $exportButton = $( '.record-list__button-bar__button.export' );
        $uploadButton = $( '.record-list__button-bar__button.upload' );
        $queueNumber = $( '.offline-enabled__queue-length' );

        store.init()
            .then( _updateRecordList );
    }

    /**
     * Obtains a record
     *
     * @param  {string} instanceId [description]
     * @return {Promise}            [description]
     */
    function get( instanceId ) {
        return store.record.get( instanceId );
    }

    /**
     * Stores a new record
     *
     * @param {*} record [description]
     * @return {Promise}
     */
    function set( record ) {
        return store.record.set( record )
            .then( _updateRecordList );
    }

    /**
     * Updates an existing record
     *
     * @param  {record} record [description]
     * @return {Promise}        [description]
     */
    function update( record ) {
        return store.record.update( record )
            .then( _updateRecordList );
    }

    /**
     * Removes a record
     * @param  {string} intanceId [description]
     * @return {Promise}        [description]
     */
    function remove( instanceId ) {
        return store.record.remove( record )
            .then( _updateRecordList );
    }

    /**
     * Gets the countervalue of a new record (guaranteed to be unique)
     *
     * @param  {string} enketoId [description]
     * @return {Promise}          [description]
     */
    function getCounterValue( enketoId ) {
        return store.property.getSurveyStats( enketoId )
            .then( function( stats ) {
                return !stats || isNaN( stats.recordCount ) ? 1 : stats.recordCount + 1;
            } );
    }

    /**
     * Marks a record as active (opened)
     *
     * @param {string} instanceId [description]
     */
    function setActive( instanceId ) {
        $( '.record-list__records' )
            .find( '.active' ).removeClass( 'active' )
            .addBack().find( '[data-id="' + instanceId + '"]' ).addClass( 'active' );
    }

    /**
     * Sets the interval to upload queued records
     */
    function _setUploadIntervals() {
        // one quick upload attempt soon after page load
        setTimeout( function() {
            uploadQueue();
        }, 30 * 1000 );
        // interval to check upload queued records
        setInterval( function() {
            uploadQueue();
        }, 5 * 60 * 1000 );
    }

    /**
     * Uploads all final records in the queue
     *
     * @return {Promise} [description]
     */
    function uploadQueue() {
        var successes = [],
            fails = [];

        if ( !uploadOngoing && connection.getOnlineStatus ) {

            console.debug( 'uploading queue' );

            uploadOngoing = true;
            // TODO: disable upload button (or in uploadProgress?)

            store.record.getAll( settings.enketoId, true )
                .then( function( records ) {
                    // Perform record uploads sequentially for nicer feedback and to avoid issues when connections are very poor
                    return records.reduce( function( prevPromise, record ) {
                        return prevPromise.then( function() {
                            // get the whole record including files
                            return store.record.get( record.instanceId )
                                .then( function( record ) {
                                    uploadProgress.update( record.instanceId, 'ongoing' );
                                    return connection.uploadRecord( record );
                                } )
                                .then( function( result ) {
                                    successes.push( record.name );
                                    // TODO: remove from store
                                    uploadProgress.update( record.instanceId, 'success', '', successes.length + fails.length, records.length );
                                } )
                                .catch( function( result ) {
                                    fails.push( record.name );
                                    uploadProgress.update( record.instanceId, 'error', gui.getErrorResponseMsg( result.status ), successes.length + fails.length, records.length );
                                } )
                                .then( function() {
                                    if ( successes.length + fails.length === records.length ) {
                                        uploadOngoing = false;
                                        if ( successes.length > 0 ) {

                                        }
                                        $( document ).trigger( 'queuesubmissionsuccess', successes );
                                        // TODO update record list

                                    }
                                } );
                        } );
                    }, new Q( null ) );
                } );
        }
    }

    /**
     * Shows upload progress and record-specific feedback
     *
     * @type {Object}
     */
    uploadProgress = {
        _getLi: function( instanceId ) {
            return $( '.record-list__records__record[data-id="' + instanceId + '"]' );
        },
        _reset: function( instanceId ) {
            var $allLis = $( '.record-list_records' ).find( 'li' );
            //if the current record, is the first in the list, reset the list
            if ( $allLis.first().attr( 'data-id' ) === instanceId ) {
                $allLis.removeClass( 'ongoing success error' ).filter( function() {
                    return !$( this ).hasClass( 'record-list__records__record' );
                } ).remove();
            }
        },
        _updateClass: function( $el, status ) {
            $el.removeClass( 'ongoing error' ).addClass( status );
        },
        _updateProgressBar: function( index, total ) {
            var $progress;

            $progress = $( '.record-list__upload-progress' ).attr( {
                'max': total,
                'value': index
            } );

            if ( index === total || total === 1 ) {
                $progress.css( 'visibility', 'hidden' );
            } else {
                $progress.css( 'visibility', 'visible' );
            }
        },
        _getMsg: function( status, msg ) {
            return ( status === 'error' ) ? msg : '';
        },
        update: function( instanceId, status, msg, index, total ) {
            var $result,
                $li = this._getLi( instanceId ),
                displayMsg = this._getMsg( status, msg );

            console.debug( 'updating progress', $li, instanceId, status, msg, index, total );
            this._reset( instanceId );

            //add display messages (always showing end status)
            if ( displayMsg ) {
                $result = $( '<li data-id="' + instanceId + '" class="' + status + '">' + displayMsg + '</li>' ).insertAfter( $li );
                window.setTimeout( function() {
                    $result.hide( 500 );
                }, 3000 );
            }

            this._updateClass( $li, status );
            if ( index && total ) {
                this._updateProgressBar( index, total );
            }

            if ( uploadQueue.length === 0 && status !== 'ongoing' ) {
                $( 'button.upload-records' ).removeAttr( 'disabled' );
            } else {
                $( 'button.upload-records' ).attr( 'disabled', 'disabled' );
            }
        }
    };

    /**
     * Updates the record list in the UI
     *
     * @return {Promise} [description]
     */
    function _updateRecordList() {
        var $newRecordList, $li,
            deferred = Q.defer();

        // reset the list
        $exportButton.prop( 'disabled', true );
        $uploadButton.prop( 'disabled', true );
        $recordList = $( '.record-list__records' ).empty();

        // rebuild the list
        return store.record.getAll( settings.enketoId )
            .then( function( records ) {
                records = records || [];
                // update queue number
                $queueNumber.text( records.length );
                // add 'no records' message
                if ( records.length === 0 ) {
                    $recordList.append( '<li class="record-list__records--none">' + t( 'record-list.norecords' ) + '</li>' );
                    deferred.resolve();
                    return deferred.promise;
                }
                // enable export button
                $exportButton.prop( 'disabled', false );
                $newRecordList = $recordList.clone();
                // add records
                records.forEach( function( record ) {
                    // if there is at least one record not marked as draft
                    if ( !record.draft ) {
                        $uploadButton.prop( 'disabled', false );
                    }
                    $li = $( '<li class="record-list__records__record" />' )
                        .text( record.name )
                        .attr( 'data-id', record.instanceId )
                        .attr( 'data-draft', !!record.draft )
                        .appendTo( $newRecordList );
                } );
                $recordList.replaceWith( $newRecordList );
            } );
    }

    /**
     * Completely flush the form cache (not the record storage)
     *
     * @return {Promise} [description]
     */
    function flush() {
        return store.flushTable( 'records' )
            .then( function() {
                store.flushTable( 'files' );
            } )
            .then( function() {
                var deferred = Q.defer();
                deferred.resolve();
                console.log( 'Done! The record store is empty now.' );
                return deferred.promise;
            } );
    }

    return {
        init: init,
        get: get,
        set: set,
        update: update,
        remove: remove,
        flush: flush,
        getCounterValue: getCounterValue,
        setActive: setActive,
        uploadQueue: uploadQueue
    };

} );
