let async = require('async');

import { Task } from '../logic/Task';
import { ProcessNotFoundExceptionV1, ProcessStoppedExceptionV1 } from 'pip-clients-processstates-node';
import { BatchSyncParam } from './BatchSyncParam';
import { ProcessParam } from '../logic/ProcessParam';
import { IMessageQueue } from 'pip-services3-messaging-node';
import { BatchSyncMessage } from './BatchSyncMessage';
import { FilterParams } from 'pip-services3-commons-node';
import { IBatchChangesClient, IBatchAllClient } from '../clients';

export class BatchSyncRecoveryTask<T> extends Task {
    public execute(callback: (err: any) => void): void {
        // Get required parameters
        var downloadResponseQueue = this._parameters.get(BatchSyncParam.DownloadResponseQueue) as IMessageQueue;
        var uploadResponseQueue = this._parameters.get(BatchSyncParam.UploadResponseQueue) as IMessageQueue;
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
                if (this.message.message_type == BatchSyncMessage.RecoveryDownload)
                    this.recoveryDownload(downloadResponseQueue, entityType, recoveryTimeout, callback);
                else if (this.message.message_type == BatchSyncMessage.RecoveryUpload)
                    this.recoveryUpload(uploadResponseQueue, entityType, recoveryTimeout, callback);
                else {
                    // If unknown message same then fail the process
                    this._logger.error(this.processId, null, '%s process received unrecognized message %s. Ignoring...', this.name, this.message);
                    async.series([
                        (callback) => {
                            this.moveMessageToDead(callback);
                        },
                        (callback) => {
                            this.continueProcess(callback);
                        }
                    ], callback)
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

    private recoveryDownload(responseQueue: IMessageQueue, typeName: string, recoveryTimeout: number,
        callback: (err: any) => void) {
        let incremental = this._parameters.getAsBooleanWithDefault(BatchSyncParam.IncrementalChanges, false);
        async.series([
            (callback) => {
                if (incremental) {
                    var startSyncTimeUtc = this.getProcessDataAs<Date>(BatchSyncParam.LastSyncTimeUtc);
                    var stopSyncTimeUtc = this.getProcessDataAs<Date>(BatchSyncParam.StopSyncTimeUtc);

                    var filter = new FilterParams();
                    filter.setAsObject('FromDateTime', startSyncTimeUtc);
                    filter.setAsObject('ToDateTime', stopSyncTimeUtc);

                    // Request to repeat download
                    let downloadAdapter = this._parameters.get(BatchSyncParam.DownloadAdapter) as IBatchChangesClient<T>;
                    downloadAdapter.downloadChanges(this.processId, filter, startSyncTimeUtc, stopSyncTimeUtc, responseQueue.getName(), null, (err) => {
                        this._logger.info(this.processId, 'Recovered download of changes %s', typeName);
                        callback(err);
                    });
                }
                else {
                    let downloadAdapter = this._parameters.get(BatchSyncParam.DownloadAdapter) as IBatchAllClient<T>;
                    downloadAdapter.downloadAll(this.processId, responseQueue.getName(), null, (err) => {
                        this._logger.info(this.processId, 'Recovered download of all %s', typeName);
                        callback(err);
                    });
                }
            },
            (callback) => {
                // Repeat recovery
                this.continueProcessWithRecovery(
                    this.queue.getName(),
                    this.message,
                    recoveryTimeout,
                    callback);
            }
        ], callback);
    }

    private recoveryUpload(responseQueue: IMessageQueue, entityType: string, recoveryTimeout: number,
        callback: (err: any) => void) {
        let incremental = this._parameters.getAsBooleanWithDefault(BatchSyncParam.IncrementalChanges, false);

        async.series([
            (callback) => {
                // Request to repeat upload
                var blobIds = this.message.getMessageAsJson() as string[];
                if (incremental) {
                    let uploadAdapter = this._parameters.get(BatchSyncParam.UploadAdapter) as IBatchChangesClient<T>;
                    uploadAdapter.uploadChanges(this.processId, blobIds, responseQueue.getName(), null, (err) => {
                        this._logger.debug(this.processId, 'Recovered upload of changes %s', entityType);
                        callback(err);
                    });
                }
                else {
                    let uploadAdapter = this._parameters.get(BatchSyncParam.UploadAdapter) as IBatchAllClient<T>;
                    uploadAdapter.uploadAll(this.processId, blobIds, responseQueue.getName(), null, (err) => {
                        this._logger.debug(this.processId, 'Recovered upload of all %s', entityType);
                        callback(err);
                    });
                }
            },
            (callback) => {
                // Repeat recovery
                this.continueProcessWithRecovery(
                    this.queue.getName(),
                    this.message,
                    recoveryTimeout,
                    callback);
            },
        ], callback)
    }
}