define( [], function() {
    "use strict";

    function blobToDataUri( blob ) {
        var deferred = Q.defer(),
            reader = new window.FileReader();

        reader.onloadend = function() {
            var base64data = reader.result;
            deferred.resolve( base64data );
        };
        reader.onerror = function( e ) {
            deferred.reject( e );
        };

        reader.readAsDataURL( blob );

        return deferred.promise;
    }

    function dataUriToBlob( dataURI ) {
        var byteString, mimeString, buffer, array, blob,
            hasArrayBufferView = new Blob( [ new Uint8Array( 100 ) ] ).size == 100, // move this to outside function
            deferred = Q.defer();

        try {
            // convert base64 to raw binary data held in a string
            // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
            byteString = atob( dataURI.split( ',' )[ 1 ] );
            // separate out the mime component
            mimeString = dataURI.split( ',' )[ 0 ].split( ':' )[ 1 ].split( ';' )[ 0 ];

            // write the bytes of the string to an ArrayBuffer
            buffer = new ArrayBuffer( byteString.length );
            array = new Uint8Array( buffer );

            for ( var i = 0; i < byteString.length; i++ ) {
                array[ i ] = byteString.charCodeAt( i );
            }

            if ( !hasArrayBufferView ) {
                array = buffer;
            }

            // write the ArrayBuffer to a blob
            blob = new Blob( [ array ], {
                type: mimeString
            } );

            deferred.resolve( blob );
        } catch ( e ) {
            deferred.reject( e );
        }

        return deferred.promise;
    }

    return {
        blobToDataUri: blobToDataUri,
        dataUriToBlob: dataUriToBlob
    };
} );
