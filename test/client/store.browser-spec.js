/* global define, describe, xdescribe, require, it, xit, before, after, beforeEach, afterEach, expect, Blob */
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
        var resourceA, resourceB, fileA;

        beforeEach( function() {
            resourceA = {
                url: '/path/to/resource1',
                item: new Blob( [ '<html>something1</html' ], {
                    type: "text/xml"
                } )
            };
            resourceB = {
                url: '/path/to/resource2',
                item: new Blob( [ '<html>something2</html' ], {
                    type: "text/xml"
                } )
            };
            fileA = {
                name: 'something.xml',
                item: new Blob( [ '<html>something1</html' ], {
                    type: "text/xml"
                } )
            };
        } );

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
                store.property.removeAll()
                    .then( done, done );
            } );

            it( 'fails if the setting object has no "name" property', function( done ) {
                store.property.update( {
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
                store.property.update( toSet )
                    .then( function() {
                        return store.property.get( 'something' );
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
                store.property.update( toSet )
                    .then( function() {
                        return store.property.get( 'something' );
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

                store.property.update( toSet )
                    .then( function( setting ) {
                        setting.value = newValue;
                        return store.property.update( setting );
                    } )
                    .then( function() {
                        return store.property.get( 'something' );
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
                store.survey.removeAll()
                    .then( done, done );
            } );

            it( 'fails if the resource has no "url" property', function( done ) {
                store.survey.resource.update( 'abcd', {
                        something: 'something'
                    } )
                    .catch( function( e ) {
                        expect( e.name ).to.equal( 'DataError' );
                        done();
                    } );
            } );

            it( 'fails if the setting object has no "item" property', function( done ) {
                store.survey.resource.update( 'abcd', {
                        url: 'something'
                    } )
                    .catch( function( e ) {
                        expect( e.name ).to.equal( 'DataError' );
                        done();
                    } );
            } );

            it( 'fails if the "item" is not a Blob', function( done ) {
                store.survey.resource.update( 'abcd', {
                        key: 'something'
                    } )
                    .catch( function( e ) {
                        expect( e.name ).to.equal( 'DataError' );
                        done();
                    } );
            } );

            it( 'succeeds if key and item are present and item is a Blob', function( done ) {
                var id = 'TESt',
                    url = resourceA.url;

                store.survey.resource.update( id, resourceA )
                    .then( function( stored ) {
                        return store.survey.resource.get( id, url );
                    } )
                    .then( function( result ) {
                        expect( result.item.type ).to.equal( resourceA.item.type );
                        expect( result.item.size ).to.equal( resourceA.item.size );
                        expect( result.item ).to.be.an.instanceof( Blob );
                        expect( result.url ).to.equal( url );
                    } )
                    .then( done, done );
            } );

        } );


        describe( 'storing surveys', function() {
            var original = '{"enketoId": "TESt", "form": "<form class=\\"or\\"></form>", "model": "<model></model>", "hash": "12345"}';

            beforeEach( function( done ) {
                store.survey.removeAll()
                    .then( done, done );
            } );

            it( 'fails if the survey has no "form" property', function() {
                var survey = JSON.parse( original );
                delete survey.form;
                // note: the throw assert works here because the error is thrown before in sync part of function
                expect( function() {
                    store.survey.set( survey );
                } ).to.throw( /not complete/ );
            } );

            it( 'fails if the survey has no "model" property', function() {
                var survey = JSON.parse( original );
                delete survey.model;
                // note: the throw assert works here because the error is thrown before in sync part of function
                expect( function() {
                    store.survey.set( survey );
                } ).to.throw( /not complete/ );
            } );

            it( 'fails if the survey has no "id" property', function() {
                var survey = JSON.parse( original );
                delete survey.enketoId;
                // note: the throw assert works here because the error is thrown before in sync part of function
                expect( function() {
                    store.survey.set( survey );
                } ).to.throw( /not complete/ );
            } );

            it( 'fails if the survey has no "hash" property', function() {
                var survey = JSON.parse( original );
                delete survey.hash;
                // note: the throw assert works here because the error is thrown before in sync part of function
                expect( function() {
                    store.survey.set( survey );
                } ).to.throw( /not complete/ );
            } );

            it( 'succeeds if the survey has the required properties and doesn\'t exist already', function( done ) {
                var survey = JSON.parse( original );
                store.survey.set( survey )
                    .then( function( result ) {
                        // check response of setSurvey
                        expect( result ).to.deep.equal( survey );
                        return store.survey.get( survey.enketoId );
                    } )
                    .then( function( result ) {
                        // check response of getSurvey
                        expect( result ).to.deep.equal( survey );
                    } )
                    .then( done, done );
            } );

            it( 'fails if a survey with that id already exists in the db', function( done ) {
                var survey = JSON.parse( original );
                store.survey.set( survey )
                    .then( function() {
                        return store.survey.set( survey );
                    } )
                    .catch( function( item, e ) {
                        expect( true ).to.equal( true );
                        done();
                    } );
            } );

        } );

        describe( 'getting surveys', function() {

            it( 'returns undefined if a survey does not exist', function( done ) {
                store.survey.get( 'nonexisting' )
                    .then( function( result ) {
                        expect( result ).to.equal( undefined );
                    } )
                    .then( done, done );
            } );

        } );

        describe( 'updating surveys', function() {
            var original = '{"enketoId": "TESt", "form": "<form class=\\"or\\"></form>", "model": "<model></model>", "hash": "12345"}';

            beforeEach( function( done ) {
                store.survey.removeAll()
                    .then( done, done );
            } );

            it( 'succeeds if the survey has the required properties and contains no file resources', function( done ) {
                var survey = JSON.parse( original );

                store.survey.set( survey )
                    .then( function() {
                        survey.model = '<model><new>value</new></model>';
                        survey.hash = '6789';
                        return store.survey.update( survey );
                    } )
                    .then( function( result ) {
                        // check response of updateSurvey
                        expect( result ).to.deep.equal( survey );
                        return store.survey.get( survey.enketoId );
                    } )
                    .then( function( result ) {
                        // check response of getSurvey
                        expect( result.model ).to.equal( survey.model );
                        expect( result.hash ).to.equal( survey.hash );
                    } )
                    .then( done, done );
            } );

            it( 'succeeds if the survey has the required properties and contains file resources', function( done ) {
                var survey = JSON.parse( original ),
                    urlA = resourceA.url;

                store.survey.set( survey )
                    .then( function() {
                        survey.resources = [ resourceA.url, resourceB.url ];
                        survey.files = [ resourceA, resourceB ];
                        return store.survey.update( survey );
                    } )
                    .then( function( result ) {
                        // check response of updateSurvey
                        expect( result ).to.deep.equal( survey );
                        return store.survey.resource.get( result.enketoId, urlA );
                    } )
                    .then( function( result ) {
                        // check response of getResource
                        expect( result.item.type ).to.equal( survey.files[ 0 ].item.type );
                        expect( result.item.size ).to.equal( survey.files[ 0 ].item.size );
                        expect( result.item ).to.be.an.instanceof( Blob );
                    } )
                    .then( done, done );
            } );
        } );

        describe( 'removing surveys', function() {
            var original = '{"enketoId": "TESty", "form": "<form class=\\"or\\"></form>", "model": "<model></model>", "hash": "12345"}';

            beforeEach( function( done ) {
                store.survey.removeAll()
                    .then( done, done );
            } );

            it( 'succeeds if the survey contains no files', function( done ) {
                var survey = JSON.parse( original );

                store.survey.set( survey )
                    .then( function() {
                        return store.survey.remove( survey.enketoId );
                    } )
                    .then( function() {
                        return store.survey.get( survey.enketoId );
                    } )
                    .then( function( result ) {
                        expect( result ).to.equal( undefined );
                    } )
                    .then( done, done );
            } );

            it( 'succeeds if the survey contains files', function( done ) {
                var survey = JSON.parse( original ),
                    url = resourceA.url;

                survey.enketoId = survey.enketoId + Math.random();

                store.survey.set( survey )
                    .then( function( result ) {
                        console.debug( "RESULT of SET", JSON.stringify( result ) );
                        survey.resources = [ resourceA.url, resourceB.url ];
                        survey.files = [ resourceA, resourceB ];
                        return store.survey.update( survey );
                    } )
                    .then( function( result ) {
                        console.debug( "RESULT of UPDATE", JSON.stringify( result ) );
                        return store.survey.remove( survey.enketoId );
                    } )
                    .then( function( result ) {
                        console.debug( "RESULT of REMOVE", JSON.stringify( result ) );
                        return store.survey.resource.get( survey.enketoId, url );
                    } )
                    .then( function( result ) {
                        console.debug( "RESULT of GETRESOURCE", JSON.stringify( result ) );
                        expect( result ).to.equal( undefined );
                        done();
                    } )
                    .catch( done );
            } );

        } );

        describe( 'storing (record) files', function() {

            beforeEach( function( done ) {
                store.record.removeAll()
                    .then( done, done );
            } );

            it( 'fails if the resource has no "name" property', function( done ) {
                store.record.file.update( 'abcd', {
                        item: fileA
                    } )
                    .catch( function( e ) {
                        expect( e.name ).to.equal( 'DataError' );
                        done();
                    } );
            } );

            it( 'fails if the setting object has no "item" property', function( done ) {
                store.record.file.update( 'abcd', {
                        name: 'something.jpg'
                    } )
                    .catch( function( e ) {
                        expect( e.name ).to.equal( 'DataError' );
                        done();
                    } );
            } );

            it( 'fails if the "item" is not a Blob', function( done ) {
                store.record.file.update( 'abcd', {
                        name: 'something',
                        item: 'a string'
                    } )
                    .catch( function( e ) {
                        expect( e.name ).to.equal( 'DataError' );
                        done();
                    } );
            } );

            it( 'succeeds if key and item are present and item is a Blob', function( done ) {
                var id = 'TESt',
                    name = fileA.name;

                store.record.file.update( id, fileA )
                    .then( function( stored ) {
                        return store.record.file.get( id, name );
                    } )
                    .then( function( result ) {
                        expect( result.item.type ).to.equal( fileA.item.type );
                        expect( result.item.size ).to.equal( fileA.item.size );
                        expect( result.item ).to.be.an.instanceof( Blob );
                        expect( result.name ).to.equal( name );
                        done();
                    } )
                    .catch( done );
            } );

        } );

        describe( 'storing records', function() {
            var original = '{"instanceId": "myID", "name": "thename", "xml": "<model></model>"}';

            beforeEach( function( done ) {
                store.record.removeAll()
                    .then( done, done );
            } );

            it( 'fails if the record has no "instanceId" property', function() {
                var rec = JSON.parse( original );
                delete rec.instanceId;
                // note: the throw assert works here because the error is thrown before in sync part of function
                expect( function() {
                    store.record.set( rec );
                } ).to.throw( /not complete/ );
            } );

            it( 'fails if the record has no "name" property', function() {
                var rec = JSON.parse( original );
                delete rec.name;
                // note: the throw assert works here because the error is thrown before in sync part of function
                expect( function() {
                    store.record.set( rec );
                } ).to.throw( /not complete/ );
            } );

            it( 'fails if the record has no "xml" property', function() {
                var rec = JSON.parse( original );
                delete rec.xml;
                // note: the throw assert works here because the error is thrown before in sync part of function
                expect( function() {
                    store.record.set( rec );
                } ).to.throw( /not complete/ );
            } );

            it( 'succeeds if the record has the required properties and doesn\'t exist already', function( done ) {
                var rec = JSON.parse( original );
                store.record.set( rec )
                    .then( function( result ) {
                        expect( result ).to.deep.equal( rec );
                        return store.record.get( rec.instanceId );
                    } )
                    .then( function( result ) {
                        expect( result.instanceId ).to.equal( rec.instanceId );
                        expect( result.xml ).to.equal( rec.xml );
                        expect( result.updated ).to.be.at.least( new Date().getTime() - 100 );
                        done();
                    } )
                    .catch( done );
            } );

            // TODO: add same test to save and obtain a record with files

            it( 'fails if a record with that instanceId already exists in the db', function( done ) {
                var rec = JSON.parse( original );
                rec.name = "another name";

                store.record.set( rec )
                    .then( function() {
                        return store.record.set( rec );
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
                store.record.removeAll()
                    .then( done, done );
            } );

            it( 'fails if the updated record has no "instanceId" property', function( done ) {
                var rec = JSON.parse( original );

                store.record.set( rec )
                    .then( function() {
                        delete rec.instanceId;
                        rec.xml = '<model><change>a</change></model>';
                        return store.record.update( rec );
                    } )
                    .catch( function( e ) {
                        expect( e.message ).to.contain( 'not complete' );
                        done();
                    } );
            } );

            it( 'fails if the updated record has no "name" property', function( done ) {
                var rec = JSON.parse( original );

                store.record.set( rec )
                    .then( function() {
                        delete rec.name;
                        rec.xml = '<model><change>a</change></model>';
                        return store.record.update( rec );
                    } )
                    .catch( function( e ) {
                        expect( e.message ).to.contain( 'not complete' );
                        done();
                    } );
            } );

            it( 'fails if the updated record has no "xml" property', function( done ) {
                var rec = JSON.parse( original );

                store.record.set( rec )
                    .then( function() {
                        delete rec.xml;
                        return store.record.update( rec );
                    } )
                    .catch( function( e ) {
                        expect( e.message ).to.contain( 'not complete' );
                        done();
                    } );
            } );

            it( 'succeeds if the updated record has the required properties', function( done ) {
                var rec = JSON.parse( original );
                store.record.set( rec )
                    .then( function() {
                        rec.xml = '<model><change>a</change></model>';
                        return store.record.update( rec );
                    } )
                    .then( function( result ) {
                        expect( result ).to.deep.equal( rec );
                        expect( result.xml ).to.equal( '<model><change>a</change></model>' );
                    } )
                    // TODO: now get the record
                    .then( done, done );
            } );

            // TODO: same test but with files

        } );


        describe( 'removing records', function() {

        } );
    } );
} );
