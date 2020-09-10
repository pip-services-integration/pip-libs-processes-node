let async = require('async');

import { Task } from '../logic/Task';
import { BatchMultiSyncParam } from './BatchMultiSyncParam';
import { ProcessParam } from '../logic/ProcessParam';
import { IMessageQueue, MessageEnvelope } from 'pip-services3-messaging-node';
import { RequestConfirmation } from '../data/RequestConfirmation';
import { BatchSyncMessage } from './BatchSyncMessage';
import { BatchSyncParam } from './BatchSyncParam';

export class BatchMultiSyncForwardMessageTask extends Task {
    public execute(callback: (err: any) => void): void {
        var uploadNotifyQueue0 = this._parameters.get(BatchMultiSyncParam.UploadNotifyQueue + '0') as IMessageQueue;
        var compensationQueue = this._parameters.get(ProcessParam.RecoveryQueue + 'Start') as IMessageQueue;

        async.series([
            (callback) => {
                // Start or activate workflow
                this.activateProcess(null, callback);
            },
            (callback) => {
                var response = this.message.getMessageAsJson() as RequestConfirmation;

                if (response == null || !response.successful) {
                    // For unsuccessful reponse request immediate recovery
                    this.failAndRecoverProcess(
                        'Failed to download all entities',
                        compensationQueue.getName(),
                        new MessageEnvelope(this.processId, BatchSyncMessage.RecoveryDownload, []),
                        null,
                        callback
                    );
                }
                // If no data was downloaded then complete the transaction
                else if (response.blob_ids == null || response.blob_ids.length == 0) {
                    this._logger.warn(this.processId, 'No data was downloaded. The workflow %s is interrupted.', this.name);

                    //var settings = await SettingsClient.ReadAsync(CorrelationId, StatusSection);
                    //var stopTime = settings.GetAsDateTime(BatchSyncParam.StopSyncTimeUtc);
                    //await WriteSettingsKeyAsync(StatusSection, BatchSyncParam.LastSyncTimeUtc, stopTime);
                    var stopTime = this.getProcessDataAs<Date>(BatchSyncParam.StopSyncTimeUtc);

                    async.series([
                        (callback) => {
                            this.writeSettingsKey(this.statusSection, BatchSyncParam.LastSyncTimeUtc, stopTime, (err, settings) => {
                                callback(err);
                            });
                        },
                        (callback) => {
                            this.completeProcess(callback);
                        }
                    ], callback);
                }
                else {
                    // Save the response message, and post it to first UploadNotify queue
                    this._logger.info(this.processId, 'Forwarding %s to %s', this.message, uploadNotifyQueue0.getName());
                    this.setProcessData(BatchSyncParam.DownloadResponseMessage, this.message);

                    async.series([
                        (callback) => {
                            uploadNotifyQueue0.send(this.processId, this.message, callback);
                        },
                        (callback) => {
                            this.completeProcess(callback);
                        },
                    ], callback);
                }
            },
        ], callback);
    }
}