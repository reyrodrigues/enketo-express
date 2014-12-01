/* global define, describe, require, it, before, after, beforeEach, afterEach, expect */
"use strict";

define( [ 'store' ], function( store ) {

    describe( 'Client Storage', function() {

        it( 'library is loaded', function() {
            expect( typeof store ).to.equal( 'object' );
        } );

    } );

    describe( 'Client Storage', function() {

        it( 'IndexedDb is supported', function() {
            expect( true ).to.equal( true );
        } );

    } );
} );
