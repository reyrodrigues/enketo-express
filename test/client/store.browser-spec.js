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

        var resourceA = {
                url: '/path/to/resource1',
                item: new Blob( [ '<html>something1</html' ], {
                    type: "text/xml"
                } )
            },
            resourceB = {
                url: '/path/to/resource2',
                item: new Blob( [ '<html>something2</html' ], {
                    type: "text/xml"
                } )
            };

        it( 'library is loaded', function() {
            expect( typeof store ).to.equal( 'object' );
        } );

        it( 'IndexedDb is supported and writeable', function( done ) {

            // In Safari the DB appears to be blocked. Occassionally this test passes.
            store.init()
                .then( done, done );
        } );

        describe( 'storing settings and properties', function() {

            beforeEach( function( done ) {
                store.flushTable( 'properties' )
                    .then( done, done );
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
                store.flushTable( 'resources' )
                    .then( done, done );
            } );

            it( 'fails if the resource has no "url" property', function( done ) {
                store.updateResource( 'abcd', {
                        something: 'something'
                    } )
                    .catch( function( e ) {
                        expect( e.name ).to.equal( 'DataError' );
                        done();
                    } );
            } );

            it( 'fails if the setting object has no "item" property', function( done ) {
                store.updateResource( 'abcd', {
                        url: 'something'
                    } )
                    .catch( function( e ) {
                        expect( e.name ).to.equal( 'DataError' );
                        done();
                    } );
            } );

            it( 'fails if the "item" is not a Blob', function( done ) {
                store.updateResource( 'abcd', {
                        key: 'something'
                    } )
                    .catch( function( e ) {
                        expect( e.name ).to.equal( 'DataError' );
                        done();
                    } );
            } );

            it( 'succeeds if key and item are present and item is a Blob', function( done ) {
                var id = 'TESt',
                    url = resourceA.url,
                    type = 'text/xml',
                    res1 = resourceA,
                    size = res1.item.size;

                store.updateResource( id, res1 )
                    .then( function( stored ) {
                        return store.getResource( id, url );
                    } )
                    .then( function( result ) {
                        expect( result.type ).to.equal( type );
                        expect( result.size ).to.equal( size );
                        expect( result ).to.be.an.instanceof( Blob );
                    } )
                    .then( done, done );
            } );

        } );


        describe( 'storing surveys', function() {
            var original = '{"enketoId": "TESt", "form": "<form class=\\"or\\"></form>", "model": "<model></model>", "hash": "12345"}';

            beforeEach( function( done ) {
                store.flushTable( 'surveys' )
                    .then( done, done );
            } );

            it( 'fails if the survey has no "form" property', function() {
                var survey = JSON.parse( original );
                delete survey.form;
                // note: the throw assert works here because the error is thrown before in sync part of function
                expect( function() {
                    store.setSurvey( survey );
                } ).to.throw( /not complete/ );
            } );

            it( 'fails if the survey has no "model" property', function() {
                var survey = JSON.parse( original );
                delete survey.model;
                // note: the throw assert works here because the error is thrown before in sync part of function
                expect( function() {
                    store.setSurvey( survey );
                } ).to.throw( /not complete/ );
            } );

            it( 'fails if the survey has no "id" property', function() {
                var survey = JSON.parse( original );
                delete survey.enketoId;
                // note: the throw assert works here because the error is thrown before in sync part of function
                expect( function() {
                    store.setSurvey( survey );
                } ).to.throw( /not complete/ );
            } );

            it( 'fails if the survey has no "hash" property', function() {
                var survey = JSON.parse( original );
                delete survey.hash;
                // note: the throw assert works here because the error is thrown before in sync part of function
                expect( function() {
                    store.setSurvey( survey );
                } ).to.throw( /not complete/ );
            } );

            it( 'succeeds if the survey has the required properties and doesn\'t exist already', function( done ) {
                var survey = JSON.parse( original );
                store.setSurvey( survey )
                    .then( function( result ) {
                        // check response of setSurvey
                        expect( result ).to.deep.equal( survey );
                        return store.getSurvey( survey.enketoId );
                    } )
                    .then( function( result ) {
                        // check response of getSurvey
                        expect( result ).to.deep.equal( survey );
                    } )
                    .then( done, done );
            } );

            it( 'fails if a survey with that id already exists in the db', function( done ) {
                var survey = JSON.parse( original );
                store.setSurvey( survey )
                    .then( function() {
                        return store.setSurvey( survey );
                    } )
                    .catch( function( e ) {
                        expect( true ).to.equal( true );
                        done();
                    } );
            } );

        } );

        describe( 'getting surveys', function() {

            it( 'returns undefined if a survey does not exist', function( done ) {
                store.getSurvey( 'nonexisting' )
                    .then( function( result ) {
                        expect( result ).to.equal( undefined );
                    } )
                    .then( done, done );
            } );

        } );

        describe( 'updating surveys', function() {
            var original = '{"enketoId": "TESt", "form": "<form class=\\"or\\"></form>", "model": "<model></model>", "hash": "12345"}';

            beforeEach( function( done ) {
                store.flushTable( 'surveys' )
                    .then( function() {
                        store.flushTable( 'resources' );
                    } )
                    .then( done, done );
            } );

            it( 'succeeds if the survey has the required properties and contains no file resources', function( done ) {
                var survey = JSON.parse( original );

                store.setSurvey( survey )
                    .then( function() {
                        survey.model = '<model><new>value</new></model>';
                        survey.hash = '6789';
                        return store.updateSurvey( survey );
                    } )
                    .then( function( result ) {
                        // check response of updateSurvey
                        expect( result ).to.deep.equal( survey );
                        return store.getSurvey( survey.enketoId );
                    } )
                    .then( function( result ) {
                        // check response of getSurvey
                        expect( result.model ).to.equal( survey.model );
                        expect( result.hash ).to.equal( survey.hash );
                    } )
                    .then( done, done );
            } );

            it( 'succeeds if the survey has the required properties and contains file resources', function( done ) {
                var survey = JSON.parse( original );

                store.setSurvey( survey )
                    .then( function() {
                        survey.resources = [ resourceA.url, resourceB.url ];
                        survey.files = [ resourceA, resourceB ];
                        return store.updateSurvey( survey );
                    } )
                    .then( function( result ) {
                        // check response of updateSurvey
                        expect( result ).to.deep.equal( survey );
                        return store.getResource( result.enketoId, result.files[ 0 ].url );
                    } )
                    .then( function( result ) {
                        // check response of getResource
                        expect( result.type ).to.equal( survey.files[ 0 ].item.type );
                        expect( result.size ).to.equal( survey.files[ 0 ].item.size );
                        expect( result ).to.be.an.instanceof( Blob );
                    } )
                    .then( done, done );
            } );
        } );

        describe( 'removing surveys', function() {
            var original = '{"enketoId": "TESty", "form": "<form class=\\"or\\"></form>", "model": "<model></model>", "hash": "12345"}';

            it( 'succeeds if the survey contains no files', function( done ) {
                var survey = JSON.parse( original );

                store.setSurvey( survey )
                    .then( function() {
                        return store.removeSurvey( survey.enketoId );
                    } )
                    .then( function() {
                        return store.getSurvey( survey.enketoId );
                    } )
                    .then( function( result ) {
                        expect( result ).to.equal( undefined );
                    } )
                    .then( done, done );
            } );
        } );

        describe( 'storing (record) files', function() {

            beforeEach( function( done ) {
                store.flushTable( 'files' )
                    .then( done, done );
            } );

            it( 'fails if the resource has no "key" property', function( done ) {
                store.updateRecordFile( {
                        something: 'something'
                    } )
                    .catch( function( e ) {
                        expect( e.name ).to.equal( 'DataError' );
                        done();
                    } );
            } );

            it( 'fails if the setting object has no "item" property', function( done ) {
                store.updateRecordFile( {
                        key: 'something'
                    } )
                    .catch( function( e ) {
                        expect( e.name ).to.equal( 'DataError' );
                        done();
                    } );
            } );

            it( 'fails if the "item" is not a Blob', function( done ) {
                store.updateRecordFile( {
                        key: 'something'
                    } )
                    .catch( function( e ) {
                        expect( e.name ).to.equal( 'DataError' );
                        done();
                    } );
            } );

            it( 'succeeds if key and item are present and item is a Blob', function( done ) {
                var id = 'TESt',
                    url = resourceA.url,
                    type = 'text/xml',
                    res1 = resourceA,
                    size = res1.item.size;

                store.updateRecordFile( res1 )
                    .then( function( stored ) {
                        return store.getRecordFile( id, url );
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

        describe( 'storing records', function() {
            var original = '{"instanceId": "myID", "name": "thename", "xml": "<model></model>"}';

            beforeEach( function( done ) {
                store.flushTable( 'records' )
                    .then( done, done );
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
                rec.name = "another name";

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


        describe( 'updating records', function() {
            var original = '{"instanceId": "myID", "name": "thename", "xml": "<model></model>"}';

            beforeEach( function( done ) {
                store.flushTable( 'records' )
                    .then( done, done );
            } );

            it( 'fails if the updated record has no "instanceId" property', function( done ) {
                var rec = JSON.parse( original );

                store.setRecord( rec )
                    .then( function() {
                        delete rec.instanceId;
                        rec.xml = '<model><change>a</change></model>';
                        return store.updateRecord( rec );
                    } )
                    .catch( function( e ) {
                        expect( e.message ).to.contain( 'not complete' );
                        done();
                    } );
            } );

            it( 'fails if the updated record has no "name" property', function( done ) {
                var rec = JSON.parse( original );

                store.setRecord( rec )
                    .then( function() {
                        delete rec.name;
                        rec.xml = '<model><change>a</change></model>';
                        return store.updateRecord( rec );
                    } )
                    .catch( function( e ) {
                        expect( e.message ).to.contain( 'not complete' );
                        done();
                    } );
            } );

            it( 'fails if the updated record has no "xml" property', function( done ) {
                var rec = JSON.parse( original );

                store.setRecord( rec )
                    .then( function() {
                        delete rec.xml;
                        return store.updateRecord( rec );
                    } )
                    .catch( function( e ) {
                        expect( e.message ).to.contain( 'not complete' );
                        done();
                    } );
            } );

            it( 'succeeds if the updated record has the required properties', function( done ) {
                var rec = JSON.parse( original );
                store.setRecord( rec )
                    .then( function() {
                        rec.xml = '<model><change>a</change></model>';
                        return store.updateRecord( rec );
                    } )
                    .then( function( result ) {
                        expect( result ).to.deep.equal( rec );
                        expect( result.xml ).to.equal( '<model><change>a</change></model>' );
                    } )
                    .then( done, done );
            } );


        } );


    } );
} );
