"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let async = require('async');
const Task_1 = require("../logic/Task");
const BatchMultiSyncParam_1 = require("./BatchMultiSyncParam");
const ProcessParam_1 = require("../logic/ProcessParam");
const pip_services3_messaging_node_1 = require("pip-services3-messaging-node");
const BatchSyncMessage_1 = require("./BatchSyncMessage");
const BatchSyncParam_1 = require("./BatchSyncParam");
class BatchMultiSyncForwardMessageTask extends Task_1.Task {
    execute(callback) {
        var uploadNotifyQueue0 = this._parameters.get(BatchMultiSyncParam_1.BatchMultiSyncParam.UploadNotifyQueue + '0');
        var compensationQueue = this._parameters.get(ProcessParam_1.ProcessParam.RecoveryQueue + 'Start');
        async.series([
            (callback) => {
                // Start or activate workflow
                this.activateProcess(null, callback);
            },
            (callback) => {
                var response = this.message.getMessageAsJson();
                if (response == null || !response.successful) {
                    // For unsuccessful reponse request immediate recovery
                    this.failAndRecoverProcess('Failed to download all entities', compensationQueue.getName(), new pip_services3_messaging_node_1.MessageEnvelope(this.processId, BatchSyncMessage_1.BatchSyncMessage.RecoveryDownload, []), null, callback);
                }
                // If no data was downloaded then complete the transaction
                else if (response.blob_ids == null || response.blob_ids.length == 0) {
                    this._logger.warn(this.processId, 'No data was downloaded. The workflow %s is interrupted.', this.name);
                    //var settings = await SettingsClient.ReadAsync(CorrelationId, StatusSection);
                    //var stopTime = settings.GetAsDateTime(BatchSyncParam.StopSyncTimeUtc);
                    //await WriteSettingsKeyAsync(StatusSection, BatchSyncParam.LastSyncTimeUtc, stopTime);
                    var stopTime = this.getProcessDataAs(BatchSyncParam_1.BatchSyncParam.StopSyncTimeUtc);
                    async.series([
                        (callback) => {
                            this.writeSettingsKey(this.statusSection, BatchSyncParam_1.BatchSyncParam.LastSyncTimeUtc, stopTime, (err, settings) => {
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
                    this.setProcessData(BatchSyncParam_1.BatchSyncParam.DownloadResponseMessage, this.message);
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
exports.BatchMultiSyncForwardMessageTask = BatchMultiSyncForwardMessageTask;
//# sourceMappingURL=BatchMultiSyncForwardMessageTask.js.map