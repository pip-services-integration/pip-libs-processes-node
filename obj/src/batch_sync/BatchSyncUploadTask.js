"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let async = require('async');
const Task_1 = require("../logic/Task");
const ProcessParam_1 = require("../logic/ProcessParam");
const pip_services3_messaging_node_1 = require("pip-services3-messaging-node");
const BatchSyncParam_1 = require("./BatchSyncParam");
const BatchSyncMessage_1 = require("./BatchSyncMessage");
class BatchSyncUploadTask extends Task_1.Task {
    execute(callback) {
        // Get required parameters
        var uploadResponseQueue = this._parameters.getAsObject(BatchSyncParam_1.BatchSyncParam.UploadResponseQueue);
        var recoveryQueue = this._parameters.getAsObject(ProcessParam_1.ProcessParam.RecoveryQueue);
        var recoveryTimeout = this._parameters.getAsNullableInteger(ProcessParam_1.ProcessParam.RecoveryTimeout);
        var typeName = this.getTypeName();
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
                    let message = new pip_services3_messaging_node_1.MessageEnvelope(this.processId, BatchSyncMessage_1.BatchSyncMessage.RecoveryDownload, []);
                    this.failAndRecoverProcess(errorMessage, recoveryQueue.getName(), message, null, callback);
                }
                // If no data was downloaded then complete the transaction
                else if (response.blob_ids == null || response.blob_ids.length == 0) {
                    this._logger.warn(this.processId, 'No %s were downloaded. The process %s is interrupted.', typeName, this.name);
                    //var settings = await SettingsClient.ReadAsync(CorrelationId, StatusSection);
                    //var stopTime = settings.GetAsDateTime(BatchSyncParam.StopSyncTimeUtc);
                    //await WriteSettingsKeyAsync(StatusSection, BatchSyncParam.LastSyncTimeUtc, stopTime);
                    var stopTime = this.getProcessDataAs(BatchSyncParam_1.BatchSyncParam.StopSyncTimeUtc);
                    async.series([
                        (callback) => {
                            this.writeSettingsKey(this.statusSection, BatchSyncParam_1.BatchSyncParam.LastSyncTimeUtc, stopTime, callback);
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
                            let incremental = this._parameters.getAsBooleanWithDefault(BatchSyncParam_1.BatchSyncParam.IncrementalChanges, false);
                            if (incremental) {
                                let uploadAdapter = this._parameters.getAsObject(BatchSyncParam_1.BatchSyncParam.UploadAdapter);
                                uploadAdapter.uploadChanges(this.processId, response.blob_ids, uploadResponseQueue.getName(), null, callback);
                            }
                            else {
                                let uploadAdapter = this._parameters.getAsObject(BatchSyncParam_1.BatchSyncParam.UploadAdapter);
                                uploadAdapter.uploadAll(this.processId, response.blob_ids, uploadResponseQueue.getName(), null, callback);
                            }
                        },
                        (callback) => {
                            this._logger.info(this.processId, 'Requested to upload all %s', typeName);
                            // Continue the process
                            this.continueProcessWithRecovery(recoveryQueue.getName(), new pip_services3_messaging_node_1.MessageEnvelope(this.processId, BatchSyncMessage_1.BatchSyncMessage.RecoveryUpload, response.blob_ids), recoveryTimeout, callback);
                        }
                    ], (err) => {
                        callback(err);
                    });
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
exports.BatchSyncUploadTask = BatchSyncUploadTask;
//# sourceMappingURL=BatchSyncUploadTask.js.map