"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchSyncDownloadTask = void 0;
let async = require('async');
const Task_1 = require("../logic/Task");
const BatchSyncParam_1 = require("./BatchSyncParam");
const pip_services3_messaging_node_1 = require("pip-services3-messaging-node");
const ProcessParam_1 = require("../logic/ProcessParam");
const pip_clients_processstates_node_1 = require("pip-clients-processstates-node");
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const BatchSyncMessage_1 = require("./BatchSyncMessage");
class BatchSyncDownloadTask extends Task_1.Task {
    constructor() {
        super(...arguments);
        this.defaultInitialSyncInterval = 24 * 60 * 1000; // 1 day
    }
    execute(callback) {
        // Get required parameters
        var downloadResponseQueue = this._parameters.get(BatchSyncParam_1.BatchSyncParam.DownloadResponseQueue);
        var recoveryQueue = this._parameters.get(ProcessParam_1.ProcessParam.RecoveryQueue);
        var recoveryTimeout = this._parameters.getAsNullableInteger(ProcessParam_1.ProcessParam.RecoveryTimeout);
        var entityType = this._parameters.getAsNullableString(ProcessParam_1.ProcessParam.EntityType);
        let startSyncTimeUtc;
        let stopSyncTimeUtc = new Date();
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
                this.setProcessData(BatchSyncParam_1.BatchSyncParam.LastSyncTimeUtc, startSyncTimeUtc);
                this.setProcessData(BatchSyncParam_1.BatchSyncParam.StopSyncTimeUtc, stopSyncTimeUtc);
                let incremental = this._parameters.getAsBooleanWithDefault(BatchSyncParam_1.BatchSyncParam.IncrementalChanges, false);
                async.series([
                    (callback) => {
                        if (incremental) {
                            var filter = new pip_services3_commons_node_1.FilterParams();
                            filter.setAsObject('FromDateTime', startSyncTimeUtc);
                            filter.setAsObject('ToDateTime', stopSyncTimeUtc);
                            let downloadAdapter = this._parameters.getAsObject(BatchSyncParam_1.BatchSyncParam.DownloadAdapter);
                            downloadAdapter.downloadChanges(this.processId, filter, startSyncTimeUtc, stopSyncTimeUtc, downloadResponseQueue.getName(), null, (err) => {
                                this._logger.info(this.processId, 'Requested to download changes %s', entityType);
                                callback(err);
                            });
                        }
                        else {
                            let downloadAdapter = this._parameters.getAsObject(BatchSyncParam_1.BatchSyncParam.DownloadAdapter);
                            downloadAdapter.downloadAll(this.processId, downloadResponseQueue.getName(), null, (err) => {
                                this._logger.info(this.processId, 'Requested to download all %s', entityType);
                                callback(err);
                            });
                        }
                    },
                    (callback) => {
                        // Continue the process
                        this.continueProcessWithRecovery(recoveryQueue.getName(), new pip_services3_messaging_node_1.MessageEnvelope(this.processId, BatchSyncMessage_1.BatchSyncMessage.RecoveryDownload, []), recoveryTimeout, (err) => {
                            callback(err);
                        });
                    },
                ], (err) => {
                    callback(err);
                });
            }
        ], (err) => {
            //if (err instanceof ProcessAlreadyExistExceptionV1) {
            if (this.checkErrorType(err, pip_clients_processstates_node_1.ProcessAlreadyExistExceptionV1)) {
                this._logger.error(this.correlationId, err, 'Process %s already running. Wait until it is completed then start a new one', this.name);
                this.completeMessage(callback);
                return;
            }
            callback(err);
        });
    }
    getStartSyncTimeUtc(callback) {
        // Read settings section
        if (this.statusSection == null) {
            callback(new Error('Settings section parameter is required'), null);
            return;
        }
        var initialSyncInterval = this._parameters.getAsIntegerWithDefault(BatchSyncParam_1.BatchSyncParam.InitialSyncInterval, this.defaultInitialSyncInterval);
        // Define default value
        var defaultStartTimeUtc = new Date(Date.now() - initialSyncInterval);
        var startSyncTimeUtc;
        // Read last sync time from status
        async.series([
            (callback) => {
                this._settingsClient.getSectionById(this.correlationId, this.statusSection, (err, parameters) => {
                    startSyncTimeUtc = parameters.getAsDateTimeWithDefault(BatchSyncParam_1.BatchSyncParam.LastSyncTimeUtc, defaultStartTimeUtc);
                    callback(err);
                });
            },
            (callback) => {
                // In case when start sync time is not valid
                if (startSyncTimeUtc == new Date(0)) {
                    startSyncTimeUtc = defaultStartTimeUtc;
                    this.writeSettingsKey(this.statusSection, BatchSyncParam_1.BatchSyncParam.LastSyncTimeUtc, startSyncTimeUtc, (err, settings) => {
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
exports.BatchSyncDownloadTask = BatchSyncDownloadTask;
//# sourceMappingURL=BatchSyncDownloadTask.js.map