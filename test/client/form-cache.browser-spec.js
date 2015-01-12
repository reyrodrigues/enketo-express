/* global define, describe, require, it, before, after, beforeEach, afterEach, expect, Blob, sinon */
"use strict";

// stubs for connection.js functions
define( 'connection', [ 'q' ], function( Q ) {
    return {
        getFormParts: function( survey ) {
            // TODO probably better to use sinon.stub()
            var deferred = Q.defer();
            deferred.resolve( {
                enketoId: 'TESt',
                form: '<form class="or"></form>',
                model: '<model></model>',
                hash: '12345'
            } );
            return deferred.promise;
        }
    };
} );

require( [ 'form-cache', 'connection' ], function( formCache, connection ) {

    describe( 'Client Form Cache', function() {
        var survey;

        beforeEach( function( done ) {
            survey = {
                enketoId: 'TESt',
            };
            formCache.flush()
                .then( function() {
                    done();
                } );
        } );

        afterEach( function() {

        } );

        it( 'is loaded', function() {
            expect( formCache ).to.be.an( 'object' );
        } );

        describe( 'in empty state', function() {

            /* needs init() first..
            it( 'can be set directly with set()', function( done ) {
                formCache.set( survey )
                    .then( formCache.get )
                    .then( function( result ) {
                        console.log( 'result', result );
                        expect( result ).to.deep.equal( survey );
                        done();
                    } );
            } );
            */
            /*
            it( 'initializes succesfully', function( done ) {
                var spy = sinon.spy( connection.getFormParts );

                formCache.init( survey )
                    .then( function( result ) {} )
                    .catch( function( error ) {
                        expect( spy ).to.have.been.called;
                        expect( spy ).to.have.been.calledWith( survey );
                        done();
                    } );
            } );
            */
        } );

        describe( 'in cached state', function() {
            it( 'initializes succesfully', function( done ) {
                survey = {
                    enketoId: 'TESt',
                    form: '<form class="or"></form>',
                    model: '<model></model>',
                    hash: '12345'
                };

                formCache.set( survey )
                    .then( function() {
                        return formCache.init( survey );
                    } )
                    .then( function( result ) {
                        expect( result ).to.deep.equal( survey );
                        done();
                    } );
            } );
        } );

        /*
        describe( 'in outdated cached state', function() {
            it( 'initializes (the outdated survey) succesfully', function() {

            } );
            it( 'updates automatically', function() {

            } );
        } );
        */
    } );
} );
