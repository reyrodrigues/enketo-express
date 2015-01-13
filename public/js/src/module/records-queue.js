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

define( [ 'store', 'q' ], function( store, Q ) {
    "use strict";

    // DEBUG
    window.store = store;

    function init() {
        // _setUploadIntervals();
        // _setEventHandlers();
    }

    function get( instanceId ) {
        return store.getRecord( instanceId );
    }

    function set( record ) {
        console.log( 'setting record' );
        return store.setRecord( record );
    }

    function update( record ) {
        return store.updateRecord( record );
    }

    function remove( record ) {
        return store.removeRecord( record );
    }

    function getCounterValue() {
        return store.getProperty( 'record-counter' )
            .then( function( counter ) {
                return isNaN( counter ) ? 1 : counter + 1;
            } );
    }

    function _setUploadIntervals() {

    }

    function _updateRecordList() {

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
        get: get,
        set: set,
        getCounterValue: getCounterValue,
        update: update,
        remove: remove,
        flush: flush
    };

} );
