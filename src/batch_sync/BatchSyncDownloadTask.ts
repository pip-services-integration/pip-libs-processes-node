let async = require('async');

import { Task } from '../logic/Task';
import { BatchSyncParam } from './BatchSyncParam';
import { IMessageQueue, MessageEnvelope } from 'pip-services3-messaging-node';
import { ProcessParam } from '../logic/ProcessParam';
import { ProcessAlreadyExistExceptionV1 } from 'pip-clients-processstates-node';
import { FilterParams } from 'pip-services3-commons-node';
import { IBatchChangesClient } from '../clients/IBatchChangesClient';
import { IBatchAllClient } from '../clients/IBatchAllClient';
import { BatchSyncMessage } from './BatchSyncMessage';

export class BatchSyncDownloadTask<T> extends Task {

    private readonly defaultInitialSyncInterval: number = 24 * 60 * 1000; // 1 day

    public execute(callback: (err: any) => void): void {
        // Get required parameters
        var downloadResponseQueue = this._parameters.get(BatchSyncParam.DownloadResponseQueue) as IMessageQueue;
        var recoveryQueue = this._parameters.get(ProcessParam.RecoveryQueue) as IMessageQueue;
        var recoveryTimeout = this._parameters.getAsNullableInteger(ProcessParam.RecoveryTimeout);
        var entityType = this._parameters.getAsNullableString(ProcessParam.EntityType);

        let startSyncTimeUtc: Date;
        let stopSyncTimeUtc: Date = new Date();

        async.series([
            (callback) => {
                // Use artificial key to allow only a single
                this.startProcess(this.processType, (err, state) => {
                    callback(err);
                });
            },
            (callback) => {
                this.getStartSyncTimeUtc((err, date) => {
                    startSyncTimeUtc = date;
                    callback(err);
                });
            },
            (callback) => {
                this.setProcessData(BatchSyncParam.LastSyncTimeUtc, startSyncTimeUtc);
                this.setProcessData(BatchSyncParam.StopSyncTimeUtc, stopSyncTimeUtc);

                let incremental: boolean = this._parameters.getAsBooleanWithDefault(BatchSyncParam.IncrementalChanges, false);
                async.series([
                    (callback) => {
                        if (incremental) {
                            var filter = new FilterParams();
                            filter.setAsObject('FromDateTime', startSyncTimeUtc);
                            filter.setAsObject('ToDateTime', stopSyncTimeUtc);

                            let downloadAdapter = this._parameters.getAsObject(BatchSyncParam.DownloadAdapter) as IBatchChangesClient<T>;
                            downloadAdapter.downloadChanges(this.processId, filter, startSyncTimeUtc, stopSyncTimeUtc, downloadResponseQueue.getName(), null, (err) => {
                                this._logger.info(this.processId, 'Requested to download changes %s', entityType);
                                callback(err);
                            });
                        }
                        else {
                            let downloadAdapter = this._parameters.getAsObject(BatchSyncParam.DownloadAdapter) as IBatchAllClient<T>;
                            downloadAdapter.downloadAll(this.processId, downloadResponseQueue.getName(), null, (err) => {
                                this._logger.info(this.processId, 'Requested to download all %s', entityType);
                                callback(err);
                            });
                        }
                    },
                    (callback) => {
                        // Continue the process
                        this.continueProcessWithRecovery(
                            recoveryQueue.getName(),
                            new MessageEnvelope(this.processId, BatchSyncMessage.RecoveryDownload, []),
                            recoveryTimeout,
                            (err) => {
                                callback(err);
                            }
                        );
                    },
                ], (err) => {
                    callback(err);
                })
            }
        ], (err) => {
            //if (err instanceof ProcessAlreadyExistExceptionV1) {
            if (this.checkErrorType(err, ProcessAlreadyExistExceptionV1)) {
                this._logger.error(this.correlationId, err, 'Process %s already running. Wait until it is completed then start a new one', this.name);
                this.completeMessage(callback);
                return;
            }

            callback(err);
        });
    }

    private getStartSyncTimeUtc(callback: (err: any, date: Date) => void) {
        // Read settings section
        if (this.statusSection == null) {
            callback(new Error('Settings section parameter is required'), null);
            return;
        }

        var initialSyncInterval = this._parameters.getAsIntegerWithDefault(
            BatchSyncParam.InitialSyncInterval, this.defaultInitialSyncInterval);

        // Define default value
        var defaultStartTimeUtc = new Date(Date.now() - initialSyncInterval);
        var startSyncTimeUtc: Date;

        // Read last sync time from status
        async.series([
            (callback) => {
                this._settingsClient.getSectionById(this.correlationId, this.statusSection, (err, parameters) => {
                    startSyncTimeUtc = parameters.getAsDateTimeWithDefault(BatchSyncParam.LastSyncTimeUtc, defaultStartTimeUtc);
                    callback(err);
                });
            },
            (callback) => {
                // In case when start sync time is not valid
                if (startSyncTimeUtc == new Date(0)) {
                    startSyncTimeUtc = defaultStartTimeUtc;
                    this.writeSettingsKey(this.statusSection, BatchSyncParam.LastSyncTimeUtc, startSyncTimeUtc, (err, settings) => {
                        callback(err);
                    });
                }
                else {
                    callback();
                }
            },
        ], (err) => {
            callback(err, startSyncTimeUtc);
        });
    }
}