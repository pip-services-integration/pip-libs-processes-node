let async = require('async');

import { Task } from '../logic/Task';
import { ProcessParam } from '../logic/ProcessParam';
import { IMessageQueue, MessageEnvelope } from 'pip-services3-messaging-node';
import { ProcessNotFoundExceptionV1, ProcessStoppedExceptionV1 } from 'pip-clients-processstates-node';
import { RequestConfirmation } from '../data/RequestConfirmation';
import { BatchSyncMessage } from './BatchSyncMessage';
import { BatchMultiSyncParam } from './BatchMultiSyncParam';
import { BatchSyncParam } from './BatchSyncParam';

export class BatchSyncCloseTask<T> extends Task {
    public execute(callback: (err: any) => void): void {
        // Get required parameters
        var recoveryQueue = this._parameters.get(ProcessParam.RecoveryQueue) as IMessageQueue;

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
                    // For unsuccessful reponse request immediate compensation
                    let errorMessage = 'Failed to upload all ' + this.getTypeName<T>();
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
                    var targetAdapterCount = this._parameters.getAsInteger(BatchMultiSyncParam.UploadAdapterCount);
                    var index = this._parameters.getAsInteger(BatchMultiSyncParam.UploadAdapterIndex);

                    // flag this branch as complete
                    this.setProcessData(BatchMultiSyncParam.UploadProcessingComplete + index, true);

                    index++;
                    if (index < targetAdapterCount) {
                        var nextUploadNotifyQueue = this._parameters.getAsObject(BatchMultiSyncParam.UploadNotifyQueue + index.toString()) as IMessageQueue;
                        var dldRespMsg = this.getProcessDataAs<MessageEnvelope>(BatchSyncParam.DownloadResponseMessage);

                        async.series([
                            (callback) => {
                                nextUploadNotifyQueue.send(this.processId, dldRespMsg, callback);
                            },
                            (callback) => {
                                this.continueProcess(callback);
                            },
                        ], (err) => {
                            this._logger.info(this.processId, 'Completed upload step ' + index);
                            callback(err);
                        });
                    }
                    else {
                        // For successful upload save sync time and complete transaction
                        //var settings = await SettingsClient.ReadAsync(CorrelationId, StatusSection);
                        //var stopTime = settings.GetAsDateTime(BatchSyncParam.StopSyncTimeUtc);
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
                        })
                    }
                }
            }
        ], (err) => {
            let processNotFoundException = err as ProcessNotFoundExceptionV1;
            if (processNotFoundException) {
                this._logger.error(this.processId, err, 'Received a message for unknown process %s. Skipping...', this.name);
                this.moveMessageToDead(callback);
                return;
            }

            let processStoppedException = err as ProcessStoppedExceptionV1;
            if (processStoppedException) {
                this._logger.error(this.processId, err, 'Received a message for inactive process %s. Skipping...', this.name);
                this.moveMessageToDead(callback);
                return;
            }

            callback(err);
        });
    }
}