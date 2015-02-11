"use strict";

var libxml = require( "libxmljs" ),
    url = require( 'url' ),
    path = require( 'path' ),
    fs = require( 'fs' ),
    express = require( 'express' ),
    router = express.Router(),
    debug = require( 'debug' )( 'manifest-controller' );

module.exports = function( app ) {
    app.use( '/', router );
};

router
    .get( '/_/manifest.appcache', manifest );

function manifest( req, res, next ) {
    res
        .set( 'Content-Type', 'text/cache-manifest' )
        .send( getManifestContent( req, res, next ) );
}

function getManifestContent( req, res, next ) {
    var value, doc,
        resources = [];

    res.render( 'surveys/webform', {
        offline: true
    }, function( err, html ) {

        if ( err ) {
            next( err );
        }

        doc = libxml.parseHtml( html );

        // href attributes of link elements
        doc.find( '//link[@href]' ).forEach( function( element ) {
            resources.push( element.attr( 'href' ).value() );
        } );

        // additional themes
        resources.forEach( function( resource ) {
            var themeStyleSheet = /theme-([A-z]+)(\.print)?\.css$/;
            if ( themeStyleSheet.test( resource ) ) {
                var foundTheme = resource.match( themeStyleSheet )[ 1 ];
                req.app.get( 'themes supported' ).forEach( function( theme ) {
                    if ( foundTheme !== theme ) {
                        resources.push( resource.replace( foundTheme, theme ) );
                    }
                } );
            }
        } );

        // any resources inside css files
        resources.forEach( function( resource ) {
            var css = /^.+\.css$/;
            if ( css.test( resource ) ) {
                try {
                    var content = fs.readFileSync( path.join( __dirname, '../../public', resource ), 'utf8' );
                    var matches = content.match( /url[\s]?\([\s]?[\'\"]?([^\)\'\"]+)[\'\"]?[\s]?\)/g );
                    debug( 'urls found', matches );
                    // TODO add URLs
                } catch ( e ) {}
            }
        } );

        // src attributes
        doc.find( '//*[@src]' ).forEach( function( element ) {
            value = element.attr( 'src' ).value();
            if ( _belongsInManifest( value ) ) {
                resources.push( value );
            }
        } );

    } );

    return 'CACHE MANIFEST\n' +
        '# hash:' + Math.random() + '\n' +
        '\n' +
        'CACHE:\n' +
        resources.join( '\n' ) + '\n' +
        '\n' +
        'FALLBACK:\n' +
        '/ /offline\n' +
        '\n' +
        'NETWORK\n' +
        '*\n';
}

function _belongsInManifest( resourceUrl ) {
    return url.parse( resourceUrl ).protocol !== 'data:';
}
