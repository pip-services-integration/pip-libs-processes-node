let async = require('async');

import { Task } from '../logic/Task';
import { ProcessParam } from '../logic/ProcessParam';
import { IMessageQueue, MessageEnvelope } from 'pip-services3-messaging-node';
import { ProcessNotFoundExceptionV1, ProcessStoppedExceptionV1 } from 'pip-clients-processstates-node';
import { RequestConfirmation } from '../data/RequestConfirmation';
import { BatchSyncMessage } from './BatchSyncMessage';
import { BatchSyncParam } from './BatchSyncParam';

export class BatchSyncCloseTask<T> extends Task {
    public execute(callback: (err: any) => void): void {
        // Get required parameters
        var recoveryQueue = this._parameters.get(ProcessParam.RecoveryQueue) as IMessageQueue;
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
                    let errorMessage = 'Failed to upload all ' + entityType;
                    let message = new MessageEnvelope(this.processId, BatchSyncMessage.RecoveryUpload, response.blob_ids);

                    this.failAndRecoverProcess(
                        errorMessage,
                        recoveryQueue.getName(),
                        message,
                        null,
                        callback
                    );
                }
                else {
                    // For successful upload save sync time and complete transaction
                    var stopTime = this.getProcessDataAs<Date>(BatchSyncParam.StopSyncTimeUtc);
                    async.series([
                        (callback) => {
                            this.writeSettingsKey(this.statusSection, BatchSyncParam.LastSyncTimeUtc, stopTime, callback);
                        },
                        (callback) => {
                            // Complete process successfully
                            this.completeProcess(callback);
                        },
                        (callback) => {
                            // Clean up blobs
                            this._tempBlobClient.deleteBlobsByIds(this.processId, response.blob_ids, callback);
                        },
                    ], (err) => {
                        this._logger.info(this.processId, 'Completed full synchronization');
                        callback(err);
                    });
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