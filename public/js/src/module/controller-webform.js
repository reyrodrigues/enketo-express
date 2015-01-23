/**
 * @preserve Copyright 2014 Martijn van de Rijdt & Harvard Humanitarian Initiative
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Deals with the main high level survey controls: saving, submitting etc.
 */

define( [ 'gui', 'connection', 'settings', 'enketo-js/Form', 'enketo-js/FormModel', 'file-manager', 'q', 'translator', 'records-queue', 'jquery' ],
    function( gui, connection, settings, Form, FormModel, fileManager, Q, t, records, $ ) {
        "use strict";
        var form, $form, $formprogress, formSelector, defaultModelStr;

        function init( selector, modelStr, instanceStrToEdit, options ) {
            var loadErrors, advice;

            formSelector = selector;
            defaultModelStr = modelStr;
            options = options || {};
            instanceStrToEdit = instanceStrToEdit || null;

            connection.init( true );

            form = new Form( formSelector, defaultModelStr, instanceStrToEdit );

            // DEBUG
            //window.form = form;
            //window.gui = gui;
            //window.store = store;

            //initialize form and check for load errors
            loadErrors = form.init();

            if (settings.offline){
                records.init();
            }

            if ( form.getEncryptionKey() ) {
                loadErrors.unshift( '<strong>' + t( 'error.encryptionnotsupported' ) + '</strong>' );
            }

            if ( loadErrors.length > 0 ) {
                console.error( 'load errors:', loadErrors );
                advice = ( instanceStrToEdit ) ? t( 'alert.loaderror.editadvice' ) : t( 'alert.loaderror.entryadvice' );
                gui.alertLoadErrors( loadErrors, advice );
            }

            $form = form.getView().$;
            $formprogress = $( '.form-progress' );

            setEventHandlers();
        }

        /**
         * Controller function to reset to a blank form. Checks whether all changes have been saved first
         * @param  {boolean=} confirmed Whether unsaved changes can be discarded and lost forever
         */
        function resetForm( confirmed ) {
            var message, choices;

            if ( !confirmed && form.getEditStatus() ) {
                message = t( 'confirm.save.msg' );
                choices = {
                    posAction: function() {
                        resetForm( true );
                    }
                };
                gui.confirm( message, choices );
            } else {
                setDraftStatus( false );
                //updateActiveRecord( null );
                form.resetView();
                form = new Form( 'form.or:eq(0)', defaultModelStr );
                form.init();
                $form = form.getView().$;
                $formprogress = $( '.form-progress' );
                //$( 'button#delete-form' ).button( 'disable' );
            }
        }

        /**
         * Used to submit a form.
         * This function does not save the record in localStorage
         * and is not used in offline-capable views.
         */
        function submitRecord() {
            var name, record, saveResult, redirect, beforeMsg, callbacks, authLink;

            //$form.trigger( 'beforesave' );
            if ( !form.isValid() ) {
                gui.alert( t( 'alert.validationerror.msg' ) );
                return;
            }
            redirect = ( typeof settings !== 'undefined' && typeof settings[ 'returnURL' ] !== 'undefined' && settings[ 'returnURL' ] ) ? true : false;
            beforeMsg = ( redirect ) ? t( 'alert.submission.redirectmsg' ) : '';
            authLink = '<a href="/login" target="_blank">' + t( 'here' ) + '</a>';

            gui.alert( beforeMsg + '<br />' +
                '<div class="loader-animation-small" style="margin: 10px auto 0 auto;"/>', t( 'alert.submission.msg' ), 'bare' );

            callbacks = {
                error: function( jqXHR ) {
                    if ( jqXHR.status === 401 ) {
                        gui.alert( t( 'alert.submissionerror.authrequiredmsg', {
                            here: authLink
                        } ), t( 'alert.submissionerror.heading' ) );
                    } else {
                        gui.alert( t( 'alert.submissionerror.tryagainmsg' ), t( 'alert.submissionerror.heading' ) );
                    }
                },
                success: function() {
                    $( document ).trigger( 'submissionsuccess' ); // since connection.processOpenRosaResponse is bypassed
                    if ( redirect ) {
                        // scroll to top to potentially work around an issue where the alert modal is not positioned correctly
                        // https://github.com/kobotoolbox/enketo-express/issues/116
                        window.scrollTo( 0, 0 );
                        gui.alert( t( 'alert.submissionsuccess.redirectmsg' ), t( 'alert.submissionsuccess.heading' ), 'success' );
                        setTimeout( function() {
                            location.href = settings.returnURL;
                        }, 1500 );
                    }
                    //also use for iframed forms
                    else {
                        gui.alert( t( 'alert.submissionsuccess.msg' ), t( 'alert.submissionsuccess.heading' ), 'success' );
                        resetForm( true );
                    }
                },
                complete: function() {}
            };

            record = {
                key: 'record',
                data: form.getDataStr( true, true ),
                files: fileManager.getCurrentFiles()
            };

            prepareFormDataArray( record ).forEach( function( batch ) {
                connection.uploadRecords( batch, true, callbacks );
            } );
        }

        function _getRecordName() {
            return records.getCounterValue()
                .then( function( counter ) {
                    return form.getRecordName() || form.getSurveyName() + ' - ' + counter;
                } );
        }

        function _confirmRecordName( recordName, errorMsg ) {
            var deferred = Q.defer(),
                texts = {
                    msg: '',
                    heading: t( 'formfooter.savedraft.label' ),
                    errorMsg: errorMsg
                },
                choices = {
                    posButton: t( 'confirm.save.posButton' ),
                    negButton: t( 'confirm.default.negButton' ),
                    posAction: function( values ) {
                        var newName = values[ 'record-name' ],
                            oldName = form.getRecordName();

                        // if the record is new or was loaded from storage and saved under the same name
                        if ( !oldName || oldName === newName ) {
                            deferred.resolve( newName, true );
                        } else {
                            _confirmRecordRename( oldName, newName )
                                .then( function() {
                                    deferred.resolve( newName, true );
                                } );
                        }
                    },
                    negAction: deferred.reject
                },
                inputs = '<label><span>' + t( 'confirm.save.name' ) + '</span>' +
                '<span class="or-hint active">' + t( 'confirm.save.hint' ) + '</span>' +
                '<input name="record-name" type="text" value="' + recordName + '"required />' + '</label>';

            gui.prompt( texts, choices, inputs );

            return deferred.promise;
        }

        function _confirmRecordRename( oldName, newName ) {
            var deferred = Q.defer();

            gui.prompt( {
                    msg: t( 'confirm.save.renamemsg', {
                        currentName: '"' + oldName + '"',
                        newName: '"' + newName + '"'
                    } )
                }, {
                    posAction: deferred.resolve,
                    negAction: deferred.reject
                }, '<label><span>' + t( 'confirm.save.name' ) + '</span><span>' + t( 'confirm.save.hint' ) + '</span>' +
                '<input name="record-name" type="text" required /></label>' );
            return deferred.promise;
        }

        function _saveRecord( recordName, confirmed, errorMsg ) {
            var record, saveMethod,
                draft = getDraftStatus();

            console.log( 'saveRecord called with recordname:', recordName, 'confirmed:', confirmed, "error:", errorMsg, 'draft:', draft );

            // triggering "beforesave" event to update possible "timeEnd" meta data in form
            $form.trigger( 'beforesave' );

            // check validity of record if necessary
            if ( !draft && !form.validate() ) {
                gui.alert( 'Form contains errors <br/>(please see fields marked in red)' );
                return;
            }

            // check recordName
            if ( !recordName ) {
                return _getRecordName()
                    .then( function( name ) {
                        _saveRecord( name, false, errorMsg );
                    } );
            }

            // check whether record name is confirmed if necessary
            if ( draft && !confirmed ) {
                return _confirmRecordName( recordName, errorMsg )
                    .then( function( name ) {
                        _saveRecord( name, true );
                    } );
            }

            // build the record object
            record = {
                'draft': draft,
                'xml': form.getDataStr( true, true ),
                'name': recordName,
                'instanceId': form.getInstanceID(),
                'enketoId': settings.enketoId,
                'files': null // TODO
            };

            // determine the save method
            saveMethod = form.getRecordName() === recordName ? 'update' : 'set';

            // save the record
            records[ saveMethod ]( record )
                .then( function() {
                    console.log( 'XML save successful!' );
                    // save any media files to the media storage but let fail quietly
                    // fileManager.saveCurrentFiles().fin( function() {
                    resetForm( true );
                    // $form.trigger( 'save', JSON.stringify( store.getRecordList() ) );

                    if ( draft ) {
                        gui.feedback( 'Record stored as draft.', 3 );
                    } else {
                        // try to send the record immediately
                        gui.feedback( 'Record queued for submission.', 3 );
                        // submitOneForced( recordName, record );
                    }
                } )
                .catch( function( error ) {
                    errorMsg = error.message;
                    if ( !errorMsg && error.target && error.target.error && error.target.error.name && error.target.error.name.toLowerCase() === 'constrainterror' ) {
                        errorMsg = t( 'confirm.save.existingerror' );
                    } else {
                        errorMsg = t( 'confirm.save.unkownerror' );
                    }
                    _saveRecord( undefined, false, errorMsg );
                } );

            // gui.alert( 'Error trying to save data locally (message: ' + saveResult + ')' );
        }


        /**
         * Builds up a record array including media files, divided into batches
         *
         * @param { { name: string, data: string } } record[ description ]
         */
        function prepareFormDataArray( record ) {
            var model = new FormModel( record.data ),
                instanceID = model.getInstanceID(),
                $fileNodes = model.$.find( '[type="file"]' ).removeAttr( 'type' ),
                xmlData = model.getStr( false, true ),
                xmlSubmissionBlob = new Blob( [ xmlData ], {
                    type: 'text/xml'
                } ),
                availableFiles = record.files || [],
                sizes = [],
                failedFiles = [],
                files = [],
                batches = [
                    []
                ],
                batchesPrepped = [],
                maxSize = connection.getMaxSubmissionSize();

            $fileNodes.each( function() {
                var file,
                    $node = $( this ),
                    nodeName = $node.prop( 'nodeName' ),
                    fileName = $node.text();

                // check if file is actually available
                availableFiles.some( function( f ) {
                    if ( f.name === fileName ) {
                        file = f;
                        return true;
                    }
                    return false;
                } );

                // add the file if it is available
                if ( file ) {
                    files.push( {
                        nodeName: nodeName,
                        file: file
                    } );
                    sizes.push( file.size );
                } else {
                    failedFiles.push( file.name );
                    console.error( 'Error occured when trying to retrieve ' + file.name );
                }
            } );

            if ( files.length > 0 ) {
                batches = divideIntoBatches( sizes, maxSize );
            }

            // console.debug( 'splitting record into ' + batches.length + ' batches to reduce submission size ', batches );

            batches.forEach( function( batch, index ) {
                var batchPrepped,
                    fd = new FormData();

                fd.append( 'xml_submission_file', xmlSubmissionBlob );

                // batch with XML data
                batchPrepped = {
                    name: record.key,
                    instanceID: instanceID,
                    formData: fd,
                    batches: batches.length,
                    batchIndex: index
                };

                // add any media files to the batch
                batch.forEach( function( fileIndex ) {
                    batchPrepped.formData.append( files[ fileIndex ].nodeName, files[ fileIndex ].file );
                } );

                // push the batch to the array
                batchesPrepped.push( batchPrepped );
            } );

            // notify user if files could not be found, but let submission go ahead anyway
            if ( failedFiles.length > 0 ) {
                gui.alert( t( 'alert.submissionerror.fnfmsg', {
                    failedFiles: failedFiles.join( ', ' ),
                    supportEmail: settings.supportEmail
                } ), t( 'alert.submissionerror.fnfheading' ) );
            }

            return batchesPrepped;
        }


        function setEventHandlers() {

            $( 'button#submit-form' )
                .click( function() {
                    var $button = $( this );
                    $button.btnBusyState( true );
                    setTimeout( function() {
                        if ( settings.offline ) {
                            _saveRecord();
                        } else {
                            form.validate();
                            submitRecord();
                        }
                        $button.btnBusyState( false );
                        return false;
                    }, 100 );
                } );

            $( document ).on( 'click', 'button#validate-form:not(.disabled)', function() {
                if ( typeof form !== 'undefined' ) {
                    var $button = $( this );
                    $button.btnBusyState( true );
                    setTimeout( function() {
                        form.validate();
                        $button.btnBusyState( false );
                        if ( !form.isValid() ) {
                            gui.alert( t( 'alert.validationerror.msg' ) );
                            return;
                        } else {
                            gui.alert( t( 'alert.validationsuccess.msg' ), t( 'alert.validationsuccess.heading' ), 'success' );
                        }
                    }, 100 );
                }
            } );

            $( document ).on( 'progressupdate', 'form.or', function( event, status ) {
                if ( $formprogress.length > 0 ) {
                    $formprogress.css( 'width', status + '%' );
                }
            } );

            if ( inIframe() && settings.parentWindowOrigin ) {
                $( document ).on( 'submissionsuccess edited', postEventAsMessageToParentWindow );
            }

            $( '.form-footer [name="draft"]' ).on( 'change', function() {
                var text = ( $( this ).prop( 'checked' ) ) ? t( "formfooter.savedraft.btn" ) : t( "formfooter.submit.btn" );
                $( '#submit-form i' ).text( ' ' + text );
            } ).closest( '.draft' ).toggleClass( 'hide', !settings.offline );
        }

        function setDraftStatus( status ) {
            status = status || false;
            $( '.form-footer [name="draft"]' ).prop( 'checked', status ).trigger( 'change' );
        }

        function getDraftStatus() {
            return $( '.form-footer [name="draft"]' ).prop( 'checked' );
        }

        /** 
         * Determines whether the page is loaded inside an iframe
         * @return {boolean} [description]
         */
        function inIframe() {
            try {
                return window.self !== window.top;
            } catch ( e ) {
                return true;
            }
        }

        /**
         * Attempts to send a message to the parent window, useful if the webform is loaded inside an iframe.
         * @param  {{type: string}} event
         */
        function postEventAsMessageToParentWindow( event ) {
            if ( event && event.type ) {
                try {
                    window.parent.postMessage( JSON.stringify( {
                        enketoEvent: event.type
                    } ), settings.parentWindowOrigin );
                } catch ( error ) {
                    console.error( error );
                }
            }
        }

        /**
         * splits an array of file sizes into batches (for submission) based on a limit
         * @param  {Array.<number>} fileSizes   array of file sizes
         * @param  {number}     limit   limit in byte size of one chunk (can be exceeded for a single item)
         * @return {Array.<Array.<number>>} array of arrays with index, each secondary array of indices represents a batch
         */

        function divideIntoBatches( fileSizes, limit ) {
            var i, j, batch, batchSize,
                sizes = [],
                batches = [];
            //limit = limit || 5 * 1024 * 1024;
            for ( i = 0; i < fileSizes.length; i++ ) {
                sizes.push( {
                    'index': i,
                    'size': fileSizes[ i ]
                } );
            }
            while ( sizes.length > 0 ) {
                batch = [ sizes[ 0 ].index ];
                batchSize = sizes[ 0 ].size;
                if ( sizes[ 0 ].size < limit ) {
                    for ( i = 1; i < sizes.length; i++ ) {
                        if ( ( batchSize + sizes[ i ].size ) < limit ) {
                            batch.push( sizes[ i ].index );
                            batchSize += sizes[ i ].size;
                        }
                    }
                }
                batches.push( batch );
                for ( i = 0; i < sizes.length; i++ ) {
                    for ( j = 0; j < batch.length; j++ ) {
                        if ( sizes[ i ].index === batch[ j ] ) {
                            sizes.splice( i, 1 );
                        }
                    }
                }
            }
            return batches;
        }

        return {
            init: init,
            divideIntoBatches: divideIntoBatches
        };
    } );
