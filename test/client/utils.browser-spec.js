/* global define, describe, require, it, before, after, beforeEach, afterEach, expect, Blob */
"use strict";

define( [ 'utils' ], function( utils ) {

    describe( 'Client Utilities', function() {

        describe( 'blob <-> dataURI conversion', function() {

            var aBlob1 = new Blob( [ '<a id="a"><b id="b">hey!</b></a>' ], {
                    type: 'text/xml'
                } ),
                aBlob2 = new Blob( [ '<a id="a">将来の仏教研究は急速に発展す</a>' ], {
                    type: 'text/xml'
                } );

            it( 'converts a blob to a string', function( done ) {
                utils.blobToDataUri( aBlob1 )
                    .then( function( result ) {
                        expect( result ).to.be.a( 'string' );
                        done();
                    } );
            } );

            it( 'converts a blob to dataUri and back to same blob', function( done ) {
                utils.blobToDataUri( aBlob1 )
                    .then( utils.dataUriToBlob )
                    .then( function( result ) {
                        expect( result.size ).to.equal( aBlob1.size );
                        expect( result.type ).to.equal( aBlob1.type );
                        expect( result ).to.deep.equal( aBlob1 );
                        done();
                    } );
            } );

            it( 'converts a blob cotaining Unicode to dataUri and back to same blob', function( done ) {
                utils.blobToDataUri( aBlob2 )
                    .then( utils.dataUriToBlob )
                    .then( function( result ) {
                        expect( result.size ).to.equal( aBlob2.size );
                        expect( result.type ).to.equal( aBlob2.type );
                        expect( result ).to.deep.equal( aBlob2 );
                        done();
                    } );
            } );

            it( 'fails to convert a string', function( done ) {
                utils.blobToDataUri( 'a string' )
                    .then( utils.dataUriToBlob )
                    .catch( function( e ) {
                        expect( e.message ).to.contain( 'TypeError' );
                        done();
                    } );
            } );

            it( 'fails to convert undefined', function( done ) {
                utils.blobToDataUri( undefined )
                    .then( utils.dataUriToBlob )
                    .catch( function( e ) {
                        expect( e.message ).to.contain( 'TypeError' );
                        done();
                    } );
            } );

            it( 'fails to convert false', function( done ) {
                utils.blobToDataUri( false )
                    .then( utils.dataUriToBlob )
                    .catch( function( e ) {
                        expect( e.message ).to.contain( 'TypeError' );
                        done();
                    } );
            } );

            it( 'fails to convert null', function( done ) {
                utils.blobToDataUri( null )
                    .then( utils.dataUriToBlob )
                    .catch( function( e ) {
                        expect( e.message ).to.contain( 'TypeError' );
                        done();
                    } );
            } );

        } );
    } );
} );
