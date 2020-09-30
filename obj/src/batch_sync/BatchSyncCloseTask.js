"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchSyncCloseTask = void 0;
let async = require('async');
const Task_1 = require("../logic/Task");
const ProcessParam_1 = require("../logic/ProcessParam");
const pip_services3_messaging_node_1 = require("pip-services3-messaging-node");
const pip_clients_processstates_node_1 = require("pip-clients-processstates-node");
const BatchSyncMessage_1 = require("./BatchSyncMessage");
const BatchSyncParam_1 = require("./BatchSyncParam");
class BatchSyncCloseTask extends Task_1.Task {
    execute(callback) {
        // Get required parameters
        var recoveryQueue = this._parameters.get(ProcessParam_1.ProcessParam.RecoveryQueue);
        var entityType = this._parameters.getAsNullableString(ProcessParam_1.ProcessParam.EntityType);
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
                    let errorMessage = 'Failed to upload all ' + entityType;
                    let message = new pip_services3_messaging_node_1.MessageEnvelope(this.processId, BatchSyncMessage_1.BatchSyncMessage.RecoveryUpload, response.blob_ids);
                    this.failAndRecoverProcess(errorMessage, recoveryQueue.getName(), message, null, callback);
                }
                else {
                    // For successful upload save sync time and complete transaction
                    var stopTime = this.getProcessDataAs(BatchSyncParam_1.BatchSyncParam.StopSyncTimeUtc);
                    async.series([
                        (callback) => {
                            this.writeSettingsKey(this.statusSection, BatchSyncParam_1.BatchSyncParam.LastSyncTimeUtc, stopTime, callback);
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
            if (this.checkErrorType(err, pip_clients_processstates_node_1.ProcessNotFoundExceptionV1)) {
                this._logger.error(this.processId, err, 'Received a message for unknown process %s. Skipping...', this.name);
                this.moveMessageToDead(callback);
                return;
            }
            //if (err instanceof ProcessStoppedExceptionV1) {
            if (this.checkErrorType(err, pip_clients_processstates_node_1.ProcessStoppedExceptionV1)) {
                this._logger.error(this.processId, err, 'Received a message for inactive process %s. Skipping...', this.name);
                this.moveMessageToDead(callback);
                return;
            }
            callback(err);
        });
    }
}
exports.BatchSyncCloseTask = BatchSyncCloseTask;
//# sourceMappingURL=BatchSyncCloseTask.js.map