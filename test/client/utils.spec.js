/* global define, describe, require, it, before, after, beforeEach, afterEach, expect */
"use strict";

define( [ 'module/utils' ], function( utils ) {

    describe( 'Client Utilities', function() {

        it( 'library is loaded', function() {
            expect( typeof utils ).to.equal( 'object' );
        } );

        describe( 'blob <-> dataURI conversion', function() {
            /* Blob constructor will be supported in PhantomJS 2.0
            
            var aBlob = new Blob( [ '<a id="a"><b id="b">hey!</b></a>' ], {
                type: 'text/xml'
            } );

            it( 'converts a blob to a string', function( done ) {
                utils.blobToDataUri( aBlob )
                    .then( function( result ) {
                        expect( result ).to.be.a( 'string' );
                        done();
                    } ); 
            } );

            it ('converts blob to dataUri and back to same blob', function(done){
                utils.blobToDataUri(aBlob)
                    .then(dataUriToBlob)
                    .then(function(result){
                        // expect(result.size).to.equal(aBlob.size);
                        // expect(result.type).to.equal(aBlob.type);
                        expect(result).to.deep.equal(aBlob);
                    })
            });

            */
        } );
    } );
} );
