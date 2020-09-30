"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchSyncRecoveryTask = void 0;
let async = require('async');
const Task_1 = require("../logic/Task");
const pip_clients_processstates_node_1 = require("pip-clients-processstates-node");
const BatchSyncParam_1 = require("./BatchSyncParam");
const ProcessParam_1 = require("../logic/ProcessParam");
const BatchSyncMessage_1 = require("./BatchSyncMessage");
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
class BatchSyncRecoveryTask extends Task_1.Task {
    execute(callback) {
        // Get required parameters
        var downloadResponseQueue = this._parameters.get(BatchSyncParam_1.BatchSyncParam.DownloadResponseQueue);
        var uploadResponseQueue = this._parameters.get(BatchSyncParam_1.BatchSyncParam.UploadResponseQueue);
        var recoveryTimeout = this._parameters.getAsNullableInteger(ProcessParam_1.ProcessParam.RecoveryTimeout);
        var entityType = this._parameters.getAsNullableString(ProcessParam_1.ProcessParam.EntityType);
        async.series([
            (callback) => {
                // Activate the process
                this.activateProcess(null, (err, state) => {
                    callback(err);
                });
            },
            (callback) => {
                if (this.message.message_type == BatchSyncMessage_1.BatchSyncMessage.RecoveryDownload)
                    this.recoveryDownload(downloadResponseQueue, entityType, recoveryTimeout, callback);
                else if (this.message.message_type == BatchSyncMessage_1.BatchSyncMessage.RecoveryUpload)
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
                    ], callback);
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
    recoveryDownload(responseQueue, typeName, recoveryTimeout, callback) {
        let incremental = this._parameters.getAsBooleanWithDefault(BatchSyncParam_1.BatchSyncParam.IncrementalChanges, false);
        async.series([
            (callback) => {
                if (incremental) {
                    var startSyncTimeUtc = this.getProcessDataAs(BatchSyncParam_1.BatchSyncParam.LastSyncTimeUtc);
                    var stopSyncTimeUtc = this.getProcessDataAs(BatchSyncParam_1.BatchSyncParam.StopSyncTimeUtc);
                    var filter = new pip_services3_commons_node_1.FilterParams();
                    filter.setAsObject('FromDateTime', startSyncTimeUtc);
                    filter.setAsObject('ToDateTime', stopSyncTimeUtc);
                    // Request to repeat download
                    let downloadAdapter = this._parameters.get(BatchSyncParam_1.BatchSyncParam.DownloadAdapter);
                    downloadAdapter.downloadChanges(this.processId, filter, startSyncTimeUtc, stopSyncTimeUtc, responseQueue.getName(), null, (err) => {
                        this._logger.info(this.processId, 'Recovered download of changes %s', typeName);
                        callback(err);
                    });
                }
                else {
                    let downloadAdapter = this._parameters.get(BatchSyncParam_1.BatchSyncParam.DownloadAdapter);
                    downloadAdapter.downloadAll(this.processId, responseQueue.getName(), null, (err) => {
                        this._logger.info(this.processId, 'Recovered download of all %s', typeName);
                        callback(err);
                    });
                }
            },
            (callback) => {
                // Repeat recovery
                this.continueProcessWithRecovery(this.queue.getName(), this.message, recoveryTimeout, callback);
            }
        ], callback);
    }
    recoveryUpload(responseQueue, entityType, recoveryTimeout, callback) {
        let incremental = this._parameters.getAsBooleanWithDefault(BatchSyncParam_1.BatchSyncParam.IncrementalChanges, false);
        async.series([
            (callback) => {
                // Request to repeat upload
                var blobIds = this.message.getMessageAsJson();
                if (incremental) {
                    let uploadAdapter = this._parameters.get(BatchSyncParam_1.BatchSyncParam.UploadAdapter);
                    uploadAdapter.uploadChanges(this.processId, blobIds, responseQueue.getName(), null, (err) => {
                        this._logger.debug(this.processId, 'Recovered upload of changes %s', entityType);
                        callback(err);
                    });
                }
                else {
                    let uploadAdapter = this._parameters.get(BatchSyncParam_1.BatchSyncParam.UploadAdapter);
                    uploadAdapter.uploadAll(this.processId, blobIds, responseQueue.getName(), null, (err) => {
                        this._logger.debug(this.processId, 'Recovered upload of all %s', entityType);
                        callback(err);
                    });
                }
            },
            (callback) => {
                // Repeat recovery
                this.continueProcessWithRecovery(this.queue.getName(), this.message, recoveryTimeout, callback);
            },
        ], callback);
    }
}
exports.BatchSyncRecoveryTask = BatchSyncRecoveryTask;
//# sourceMappingURL=BatchSyncRecoveryTask.js.map