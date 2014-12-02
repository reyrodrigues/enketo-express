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

            it( 'fails if the setting object has no "name" property', function( done ) {
                store.updateSetting( {
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
                store.updateSetting( toSet )
                    .then( function() {
                        return store.getSetting( 'something' );
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
                store.updateSetting( toSet )
                    .then( function() {
                        return store.getSetting( 'something' );
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

                store.updateSetting( toSet )
                    .then( function( setting ) {
                        setting.value = newValue;
                        return store.updateSetting( setting );
                    } )
                    .then( function() {
                        return store.getSetting( 'something' );
                    } )
                    .then( function( setting ) {
                        expect( setting.value ).to.equal( newValue );
                        done();
                    } )
                    .catch( done );
            } );

        } );

        describe( 'storing (form) resources', function() {

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
                var id = 'YYYp',
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

        describe( 'storing surveys', function() {

        } );
    } );
} );
