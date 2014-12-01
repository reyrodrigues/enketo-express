/* jshint browser: true */
"use strict";

var allTestFiles = [];
var TEST_REGEXP = /(spec|test)\.js$/i;

var pathToModule = function( path ) {
    return path.replace( /^\/base\//, '' ).replace( /\.js$/, '' );
};

Object.keys( window.__karma__.files ).forEach( function( file ) {
    if ( TEST_REGEXP.test( file ) ) {
        // Normalize paths to RequireJS module names.
        allTestFiles.push( pathToModule( file ) );
    }
} );

// TODO It should be possible to load /public/js/src/require-config and then override the baseUrl
// and the additional properties below

require.config( {
    // Karma serves files under /base, which is the basePath from your config file
    baseUrl: '/base/public/js/src/module',

    paths: {
        'test': '../../../../test',
        'q': '../../../lib/bower-components/q/q',
        'db': '../../../lib/db.js/src/db'
    },

    // dynamically load all test files
    deps: allTestFiles,

    // we have to kickoff jasmine, as it is asynchronous
    callback: window.__karma__.start
} );
