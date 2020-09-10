"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let async = require('async');
const Task_1 = require("../logic/Task");
const pip_services3_messaging_node_1 = require("pip-services3-messaging-node");
const ProcessParam_1 = require("../logic/ProcessParam");
const BatchSyncMessage_1 = require("./BatchSyncMessage");
const BatchMultiSyncParam_1 = require("./BatchMultiSyncParam");
const BatchSyncParam_1 = require("./BatchSyncParam");
class BatchMultiSyncCloseTask extends Task_1.Task {
    execute(callback) {
        // Get required parameters
        var recoveryQueue = this._parameters.get(ProcessParam_1.ProcessParam.RecoveryQueue);
        async.series([
            (callback) => {
                // Activate the process
                this.activateProcess(null, (err, state) => {
                    callback(err);
                });
            },
            (callback) => {
                var response = this.message.getMessageAsJson();
                if (response != null && !response.successful) {
                    // For unsuccessful reponse request immediate recovery
                    let errorMessage = 'Failed to download all entities';
                    let message = new pip_services3_messaging_node_1.MessageEnvelope(this.processId, BatchSyncMessage_1.BatchSyncMessage.RecoveryUpload, []);
                    this.failAndRecoverProcess(errorMessage, recoveryQueue.getName(), message, null, callback);
                }
                else {
                    var targetAdapterCount = this._parameters.getAsInteger(BatchMultiSyncParam_1.BatchMultiSyncParam.UploadAdapterCount);
                    var index = this._parameters.getAsInteger(BatchMultiSyncParam_1.BatchMultiSyncParam.UploadAdapterIndex);
                    // flag this branch as complete
                    this.setProcessData(BatchMultiSyncParam_1.BatchMultiSyncParam.UploadProcessingComplete + index, true);
                    index++;
                    if (index < targetAdapterCount) {
                        var nextUploadNotifyQueue = this._parameters.get(BatchMultiSyncParam_1.BatchMultiSyncParam.UploadNotifyQueue + index.toString());
                        var dldRespMsg = this.getProcessDataAs(BatchSyncParam_1.BatchSyncParam.DownloadResponseMessage);
                        async.series([
                            (callback) => {
                                nextUploadNotifyQueue.send(this.processId, dldRespMsg, callback);
                            },
                            (callback) => {
                                this.continueProcess(callback);
                            }
                        ], (err) => {
                            this._logger.info(this.processId, 'Completed upload step ' + index);
                            callback(err);
                        });
                    }
                    else {
                        // For successful upload save sync time and complete transaction
                        //var settings = await SettingsClient.ReadAsync(CorrelationId, StatusSection);
                        //var stopTime = settings.GetAsDateTime(BatchSyncParam.StopSyncTimeUtc);
                        var stopTime = this.getProcessDataAs(BatchSyncParam_1.BatchSyncParam.StopSyncTimeUtc);
                        async.series([
                            (callback) => {
                                this.writeSettingsKey(this.statusSection, BatchSyncParam_1.BatchSyncParam.LastSyncTimeUtc, stopTime, (err, settings) => {
                                    callback(err);
                                });
                            },
                            (callback) => {
                                // Complete workflow successfully
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
            }
        ], (err) => {
            let processNotFoundException = err;
            if (processNotFoundException) {
                this._logger.error(this.processId, err, 'Received a message for unknown process %s. Skipping...', this.name);
                this.moveMessageToDead(callback);
                return;
            }
            let processStoppedException = err;
            if (processStoppedException) {
                this._logger.error(this.processId, err, 'Received a message for inactive process %s. Skipping...', this.name);
                this.moveMessageToDead(callback);
                return;
            }
            callback(err);
        });
    }
}
exports.BatchMultiSyncCloseTask = BatchMultiSyncCloseTask;
//# sourceMappingURL=BatchMultiSyncCloseTask.js.map