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

define( [ 'store', 'q', 'settings', 'translator' ], function( store, Q, settings, t ) {
    "use strict";

    var $exportButton, $uploadButton, $recordList, $queueNumber;

    // DEBUG
    window.store = store;

    function init() {
        // _setUploadIntervals();
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

    }

    function _updateRecordList() {
        var $newRecordList, $li,
            deferred = Q.defer();

        // reset the list
        $exportButton.prop( 'disabled', true );
        $uploadButton.prop( 'disabled', true );
        $recordList = $( '.record-list__records' ).empty();

        // TODO: an error is swallowed here, e.g remove settings.enketoId below
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
            } )
        ;
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
    };

} );
