let async = require('async');

import { Task } from '../logic/Task';
import { ProcessParam } from '../logic/ProcessParam';
import { IMessageQueue, MessageEnvelope } from 'pip-services3-messaging-node';
import { ProcessNotFoundExceptionV1, ProcessStoppedExceptionV1 } from 'pip-clients-processstates-node';
import { BatchSyncParam } from './BatchSyncParam';
import { RequestConfirmation } from '../data/RequestConfirmation';
import { BatchSyncMessage } from './BatchSyncMessage';
import { IBatchChangesClient } from '../clients/IBatchChangesClient';
import { IBatchAllClient } from '../clients/IBatchAllClient';

export class BatchSyncUploadTask<T> extends Task {
    public execute(callback: (err: any) => void): void {
        // Get required parameters
        var uploadResponseQueue = this._parameters.getAsObject(BatchSyncParam.UploadResponseQueue) as IMessageQueue;
        var recoveryQueue = this._parameters.getAsObject(ProcessParam.RecoveryQueue) as IMessageQueue;
        var recoveryTimeout = this._parameters.getAsNullableInteger(ProcessParam.RecoveryTimeout);
        var entityType = this._parameters.getAsNullableString(ProcessParam.EntityType);

        async.series([
            (callback) => {
                // Activate the process
                this.activateProcess(null, (err, state) => {
                    callback(err);
                });
            },
            (callback) => {
                var response = this.message.getMessageAsJson() as RequestConfirmation;
                if (response != null && !response.successful) {
                    // For unsuccessful reponse request immediate recovery
                    let errorMessage = 'Failed to download all entities';
                    let message = new MessageEnvelope(this.processId, BatchSyncMessage.RecoveryDownload, []);

                    this.failAndRecoverProcess(
                        errorMessage,
                        recoveryQueue.getName(),
                        message,
                        null,
                        callback
                    );
                }
                // If no data was downloaded then complete the transaction
                else if (response.blob_ids == null || response.blob_ids.length == 0) {
                    this._logger.warn(this.processId, 'No %s were downloaded. The process %s is interrupted.', entityType, this.name);

                    var stopTime = this.getProcessDataAs<Date>(BatchSyncParam.StopSyncTimeUtc);
                    async.series([
                        (callback) => {
                            this.writeSettingsKey(this.statusSection, BatchSyncParam.LastSyncTimeUtc, stopTime, callback);
                        },
                        (callback) => {
                            this.completeProcess(callback);
                        },
                    ], callback);
                }
                else {
                    // For successful download initiate upload
                    async.series([
                        (callback) => {
                            let incremental = this._parameters.getAsBooleanWithDefault(BatchSyncParam.IncrementalChanges, false);
                            if (incremental) {
                                let uploadAdapter = this._parameters.getAsObject(BatchSyncParam.UploadAdapter) as IBatchChangesClient<T>;
                                uploadAdapter.uploadChanges(this.processId, response.blob_ids, uploadResponseQueue.getName(), null, callback);
                            }
                            else {
                                let uploadAdapter = this._parameters.getAsObject(BatchSyncParam.UploadAdapter) as IBatchAllClient<T>;
                                uploadAdapter.uploadAll(this.processId, response.blob_ids, uploadResponseQueue.getName(), null, callback);
                            }
                        },
                        (callback) => {
                            this._logger.info(this.processId, 'Requested to upload all %s', entityType);

                            // Continue the process
                            this.continueProcessWithRecovery(
                                recoveryQueue.getName(),
                                new MessageEnvelope(this.processId, BatchSyncMessage.RecoveryUpload, response.blob_ids),
                                recoveryTimeout,
                                callback
                            );
                        }
                    ], (err) => {
                        callback(err);
                    })
                }
            }
        ], (err) => {
            //if (err instanceof ProcessNotFoundExceptionV1) {
            if (this.checkErrorType(err, ProcessNotFoundExceptionV1)) {
                this._logger.error(this.processId, err, 'Received a message for unknown process %s. Skipping...', this.name);
                this.moveMessageToDead(callback);
                return;
            }

            //if (err instanceof ProcessStoppedExceptionV1) {
            if (this.checkErrorType(err, ProcessStoppedExceptionV1)) {
                this._logger.error(this.processId, err, 'Received a message for inactive process %s. Skipping...', this.name);
                this.moveMessageToDead(callback);
                return;
            }

            callback(err);
        });
    }
}