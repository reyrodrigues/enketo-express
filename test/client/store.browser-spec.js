/* global define, describe, require, it, before, after, beforeEach, afterEach, expect, Blob */
"use strict";

/**
 * ***********************************************************************************************************
 * Once PhantomJS 2.0 can be used for testing we can move these tests to the general (headless+browser) spec
 * ***********************************************************************************************************
 *
 * When using actual browsers for testing be careful that an open browser window with the same domain, may
 * lock up indexedDb!
 *
 */

// TODO: when chai-as-promised adapter is working, convert these tests using .eventually.

define( [ 'store' ], function( store ) {

    describe( 'Client Storage', function() {

        it( 'library is loaded', function() {
            expect( typeof store ).to.equal( 'object' );
        } );

        it( 'IndexedDb is supported and writeable', function( done ) {

            store.init()
                .then( function() {
                    expect( 'this to be reached' ).to.be.a( 'string' );
                    done();
                } )
                .catch( done );
        } );

        describe( 'storing settings', function() {

            beforeEach( function( done ) {
                store.flush()
                    .then( store.init )
                    .then( done );
            } );

            it( 'fails if the setting object has no "name" property', function( done ) {
                store.updateProperty( {
                        something: 'something'
                    } )
                    .catch( function( e ) {
                        expect( e.name ).to.equal( 'DataError' );
                        done();
                    } );
            } );

            it( 'succeeds if the setting object has a "name" property', function( done ) {
                var toSet = {
                    name: 'something',
                    value: new Date().getTime()
                };
                store.updateProperty( toSet )
                    .then( function() {
                        return store.getProperty( 'something' );
                    } )
                    .then( function( setting ) {
                        expect( setting ).to.deep.equal( toSet );
                        done();
                    } )
                    .catch( done );
            } );

            it( 'is able to store simple objects as a setting', function( done ) {
                var toSet = {
                    name: 'something',
                    value: {
                        complex: true,
                        more_complex: {
                            is: true
                        }
                    }
                };
                store.updateProperty( toSet )
                    .then( function() {
                        return store.getProperty( 'something' );
                    } )
                    .then( function( setting ) {
                        expect( setting ).to.deep.equal( toSet );
                        done();
                    } )
                    .catch( done );
            } );

            it( 'will update the setting if it already exists', function( done ) {
                var toSet = {
                        name: 'something',
                        value: new Date().getTime()
                    },
                    newValue = 'something else';

                store.updateProperty( toSet )
                    .then( function( setting ) {
                        setting.value = newValue;
                        return store.updateProperty( setting );
                    } )
                    .then( function() {
                        return store.getProperty( 'something' );
                    } )
                    .then( function( setting ) {
                        expect( setting.value ).to.equal( newValue );
                        done();
                    } )
                    .catch( done );
            } );

        } );

        describe( 'storing (form) resources', function() {

            beforeEach( function( done ) {
                store.flush()
                    .then( store.init )
                    .then( done );
            } );

            it( 'fails if the resource has no "key" property', function( done ) {
                store.updateResource( {
                        something: 'something'
                    } )
                    .catch( function( e ) {
                        expect( e.name ).to.equal( 'DataError' );
                        done();
                    } );
            } );

            it( 'fails if the setting object has no "item" property', function( done ) {
                store.updateResource( {
                        key: 'something'
                    } )
                    .catch( function( e ) {
                        expect( e.name ).to.equal( 'DataError' );
                        done();
                    } );
            } );

            it( 'fails if the "item" is not a Blob', function( done ) {
                store.updateResource( {
                        key: 'something'
                    } )
                    .catch( function( e ) {
                        expect( e.name ).to.equal( 'DataError' );
                        done();
                    } );
            } );

            it( 'succeeds if key and item are present and item is a Blob', function( done ) {
                var id = 'TESt',
                    url = '/some/path/for/example',
                    type = 'text/xml',
                    res1 = {
                        key: id + ':' + url,
                        item: new Blob( [ '<html>something</html' ], {
                            type: "text/xml"
                        } )
                    },
                    size = res1.item.size;

                store.updateResource( res1 )
                    .then( function( stored ) {
                        return store.getResource( id, url );
                    } )
                    .then( function( result ) {
                        expect( result.type ).to.equal( type );
                        expect( result.size ).to.equal( size );
                        expect( result ).to.be.an.instanceof( Blob );
                        done();
                    } )
                    .catch( done );
            } );

        } );


        // TODO: I think these tests are flawed. See records test for alternative.
        describe( 'storing surveys', function() {
            var survey,
                setSurveyTest = function() {
                    return store.setSurvey( survey );
                };

            beforeEach( function( done ) {
                survey = {
                    enketoId: 'TESt',
                    form: '<form class="or"></form>',
                    model: '<model></model>',
                    hash: '12345'
                };

                store.flush()
                    .then( store.init )
                    .then( done );
            } );

            it( 'fails if the survey has no "form" property', function() {
                delete survey.form;
                // note: the throw assert works here because the error is thrown before in sync part of function
                expect( setSurveyTest ).to.throw( /not complete/ );
            } );

            it( 'fails if the survey has no "model" property', function() {
                delete survey.model;
                // note: the throw assert works here because the error is thrown before in sync part of function
                expect( setSurveyTest ).to.throw( /not complete/ );
            } );

            it( 'fails if the survey has no "id" property', function() {
                delete survey.enketoId;
                // note: the throw assert works here because the error is thrown before in sync part of function
                expect( setSurveyTest ).to.throw( /not complete/ );
            } );

            it( 'fails if the survey has no "hash" property', function() {
                delete survey.hash;
                // note: the throw assert works here because the error is thrown before in sync part of function
                expect( setSurveyTest ).to.throw( /not complete/ );
            } );

            it( 'succeeds if the survey has the required properties and doesn\'t exist already', function( done ) {
                setSurveyTest()
                    .then( function( result ) {
                        expect( result ).to.deep.equal( survey );
                        done();
                    } );
            } );

            it( 'fails if a survey with that id already exists in the db', function( done ) {
                setSurveyTest()
                    .then( setSurveyTest )
                    .catch( function( e ) {
                        expect( true ).to.equal( true );
                        done();
                    } );
            } );

        } );


        describe( 'storing records', function() {
            var original = '{"instanceId": "myID", "name": "thename", "xml": "<model></model>"}';

            beforeEach( function( done ) {
                store.flush()
                    .then( store.init )
                    .then( done );
            } );

            it( 'fails if the record has no "instanceId" property', function() {
                var rec = JSON.parse( original );
                delete rec.instanceId;
                // note: the throw assert works here because the error is thrown before in sync part of function
                expect( function() {
                    store.setRecord( rec );
                } ).to.throw( /not complete/ );
            } );

            it( 'fails if the record has no "name" property', function() {
                var rec = JSON.parse( original );
                delete rec.name;
                // note: the throw assert works here because the error is thrown before in sync part of function
                expect( function() {
                    store.setRecord( rec );
                } ).to.throw( /not complete/ );
            } );

            it( 'fails if the record has no "xml" property', function() {
                var rec = JSON.parse( original );
                delete rec.xml;
                // note: the throw assert works here because the error is thrown before in sync part of function
                expect( function() {
                    store.setRecord( rec );
                } ).to.throw( /not complete/ );
            } );

            it( 'succeeds if the record has the required properties and doesn\'t exist already', function( done ) {
                var rec = JSON.parse( original );
                store.setRecord( rec )
                    .then( function( result ) {
                        expect( result ).to.deep.equal( rec );
                        done();
                    } );
            } );

            it( 'fails if a record with that instanceId already exists in the db', function( done ) {
                var rec = JSON.parse( original );
                store.setRecord( rec )
                    .then( function() {
                        return store.setRecord( rec );
                    } )
                    .catch( function( e ) {
                        // TODO FF throws a ConstraintError but for some reason this is not caught here
                        expect( true ).to.equal( true );
                        done();
                    } );
            } );

        } );
    } );
} );
