"use strict";

var libxml = require( "libxmljs" ),
    url = require( 'url' ),
    path = require( 'path' ),
    fs = require( 'fs' ),
    Q = require( 'q' ),
    config = require( '../../config/config' ),
    client = require( 'redis' ).createClient( config.redis.cache.port, config.redis.cache.host, {
        auth_pass: config.redis.cache.password
    } ),
    utils = require( '../lib/utils' ),
    debug = require( 'debug' )( 'manifest-model' );

// in test environment, switch to different db
if ( process.env.NODE_ENV === 'test' ) {
    client.select( 15 );
}

function getManifest( html, lang ) {
    var hash, doc, resources, app, themesSupported,
        key = 'ma:' + utils.md5( html ) + '_' + lang,
        deferred = Q.defer();

    // each language gets its own manifest
    client.get( key, function( error, manifest ) {
        if ( error ) {
            deferred.reject( error );
        } else if ( manifest ) {
            debug( 'getting manifest from cache' );
            deferred.resolve( manifest );
        } else {
            debug( 'building manifest from scratch' );
            doc = libxml.parseHtml( html );
            resources = [];
            app = require( '../../config/express' );
            themesSupported = app.get( 'themes supported' ) || [];

            // href attributes of link elements
            resources = resources.concat( _getLinkHrefs( doc ) );

            // additional themes
            resources = resources.concat( _getAdditionalThemes( resources, themesSupported ) );

            // translations
            resources = resources.concat( _getTranslations( lang ) );

            // any resources inside css files
            resources = resources.concat( _getResourcesFromCss( resources ) );

            // src attributes
            resources = resources.concat( _getSrcAttributes( doc ) );

            // remove non-existing files, empties, duplicates and non-http urls
            resources = resources
                .filter( _removeEmpties )
                .filter( _removeDuplicates )
                .filter( _removeNonHttpResources )
                .filter( _removeNonExisting );

            // calculate the hash to serve as the manifest version number
            hash = _getHashFromResources( resources );

            // build manifest string
            manifest = 'CACHE MANIFEST\n' +
                '# hash:' + hash + '\n' +
                '\n' +
                'CACHE:\n' +
                resources.join( '\n' ) + '\n' +
                '\n' +
                'FALLBACK:\n' +
                '/ /offline\n' +
                '\n' +
                'NETWORK:\n' +
                '*\n';

            // cache manifest for a day, don't wait for result
            client.set( key, manifest, 'EX', 24 * 60, function() {} );

            deferred.resolve( manifest );
        }
    } );

    return deferred.promise;
}

function _getLinkHrefs( doc ) {
    return doc.find( '//link[@href]' ).map( function( element ) {
        return element.attr( 'href' ).value();
    } );
}

function _getSrcAttributes( doc ) {
    return doc.find( '//*[@src]' ).map( function( element ) {
        return element.attr( 'src' ).value();
    } );
}

function _getAdditionalThemes( resources, themes ) {
    var urls = [];

    resources.forEach( function( resource ) {
        var themeStyleSheet = /theme-([A-z]+)(\.print)?\.css$/;
        if ( themeStyleSheet.test( resource ) ) {
            var foundTheme = resource.match( themeStyleSheet )[ 1 ];
            themes.forEach( function( theme ) {
                var themeUrl = resource.replace( foundTheme, theme );
                urls.push( themeUrl );
            } );
        }
    } );

    return urls;
}

function _getTranslations( lang ) {
    return ( lang ) ? '/locales/' + lang + '/translation.json' : null;
}

function _getResourcesFromCss( resources ) {
    var content, matches,
        urlReg = /url\(['|"]?([^\)'"]+)['|"]?\)/g,
        cssReg = /^.+\.css$/,
        urls = [];

    resources.forEach( function( resource ) {
        if ( cssReg.test( resource ) ) {
            content = _getResourceContent( resource );
            while ( ( matches = urlReg.exec( content ) ) !== null ) {
                urls.push( matches[ 1 ] );
            }
        }
    } );

    return urls;
}

function _getResourceContent( resource ) {
    var rel;
    // in try catch in case css file is missing
    try {
        rel = ( resource.indexOf( '/locales/' ) === 0 ) ? '../../' : '../../public';
        return fs.readFileSync( path.join( __dirname, rel, url.parse( resource ).pathname ), 'utf8' );
    } catch ( e ) {
        return '';
    }
}

function _removeNonExisting( resource ) {
    var rel = ( resource.indexOf( '/locales/' ) === 0 ) ? '../../' : '../../public',
        resourcePath = path.join( __dirname, rel, url.parse( resource ).pathname ),
        // TODO: in later versions of node.js, this should be replaced by: fs.accessSync(resourcePath, fs.R_OK)
        exists = fs.existsSync( resourcePath );

    if ( !exists ) {
        debug( 'cannot find', resourcePath );
    }
    return exists;
}

function _removeEmpties( resource ) {
    return !!resource;
}

function _removeDuplicates( resource, position, array ) {
    return array.indexOf( resource ) == position;
}

function _removeNonHttpResources( resourceUrl ) {
    var parsedUrl = url.parse( resourceUrl );
    return parsedUrl.path && parsedUrl.protocol !== 'data:';
}

function _getHashFromResources( resources ) {
    var content,
        hash = '';

    resources.forEach( function( resource ) {
        try {
            content = _getResourceContent( resource );
            hash += utils.md5( content );
        } catch ( e ) {}
    } );

    // shorten hash
    return utils.md5( hash );
}

module.exports = {
    get: getManifest
};
