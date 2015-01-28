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

    function get( instanceId ) {
        return store.record.get( instanceId );
    }

    function set( record ) {
        return store.record.set( record )
            .then( _updateRecordList );
    }

    function update( record ) {
        return store.record.update( record )
            .then( _updateRecordList );
    }

    function remove( record ) {
        return store.record.remove( record )
            .then( _updateRecordList );
    }

    function getCounterValue( enketoId ) {
        return store.property.getSurveyStats( enketoId )
            .then( function( stats ) {
                return !stats || isNaN( stats.recordCount ) ? 1 : stats.recordCount + 1;
            } );
    }

    function setActive( instanceId ) {
        $( '.record-list__records' )
            .find( '.active' ).removeClass( 'active' )
            .addBack().find( '[data-id="' + instanceId + '"]' ).addClass( 'active' );
    }

    function _setUploadIntervals() {
        setTimeout( function() {
            uploadQueue();
        }, 30 * 1000 );
        setInterval( function() {
            uploadQueue();
        }, 5 * 60 * 1000 );
    }

    function uploadQueue() {
        var successes = [],
            fails = [];

        if ( !uploadOngoing && connection.getOnlineStatus ) {

            console.debug( 'uploading queue' );

            uploadOngoing = true;
            // TODO: disable upload button (or in uploadProgress?)

            store.record.getAll( settings.enketoId, true )
                .then( function( records ) {
                    console.debug( 'records length', records.length );
                    // TODO: should these be done sequentially? Would look nicer in sidebar...
                    records.forEach( function( record ) {
                        // get the whole record including files
                        store.record.get( record.instanceId )
                            .then( function( record ) {
                                connection.uploadRecord( record );
                                uploadProgress.update( record.instanceId, 'ongoing', '', successes.length + fails.length, records.length );
                            } )
                            .then( function( result ) {
                                successes.push( record.name );
                                // TODO: remove from store
                                uploadProgress.update( record.instanceId, 'success' );
                            } )
                            .catch( function( result ) {
                                fails.push( record.name );
                                uploadProgress.update( record.instanceId, 'error', gui.getErrorResponseMsg( result.status ) );
                            } )
                            .then( function() {
                                if ( successes.length + fails.length === records.length ) {
                                    uploadOngoing = false;
                                    if ( successes.length > 0 ) {}
                                    $( document ).trigger( 'queuesubmissionsuccess', successes );
                                    // TODO update record list
                                }
                            } );
                    } );
                } );
        }
    }

    uploadProgress = {
        _getLi: function( instanceId ) {
            return $( '.record-list__records__record' ).find( '[data-id="' + instanceId + '"]' );
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
                $lis = this._getLi( instanceId ),
                displayMsg = this._getMsg( status, msg );

            console.debug( 'updating progress', instanceId, status, msg, index, total );
            this._reset( instanceId );

            //add display messages (always showing end status)
            if ( displayMsg ) {
                $result = $( '<li data-id="' + instanceId + '" class="' + status + '">' + displayMsg + '</li>' ).insertAfter( $lis.last() );
                window.setTimeout( function() {
                    $result.hide( 500 );
                }, 3000 );
            }

            this._updateClass( $lis.first(), status );
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
     * Completely flush the form cache (not the data storage)
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
