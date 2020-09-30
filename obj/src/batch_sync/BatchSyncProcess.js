"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchSyncProcess = void 0;
const Process_1 = require("../logic/Process");
const BatchSyncParam_1 = require("./BatchSyncParam");
const BatchSyncName_1 = require("./BatchSyncName");
const BatchSyncDownloadTask_1 = require("./BatchSyncDownloadTask");
const BatchSyncUploadTask_1 = require("./BatchSyncUploadTask");
const BatchSyncCloseTask_1 = require("./BatchSyncCloseTask");
const BatchSyncRecoveryTask_1 = require("./BatchSyncRecoveryTask");
class BatchSyncProcess extends Process_1.Process {
    constructor(processType, references, parameters) {
        super(processType, references, parameters);
        if (parameters == null)
            throw new Error('Process parameters are not defined');
        // Get required queues
        var startQueue = parameters.getAsObject(BatchSyncParam_1.BatchSyncParam.StartQueue);
        var downloadResponseQueue = parameters.getAsObject(BatchSyncParam_1.BatchSyncParam.DownloadResponseQueue);
        var uploadResponseQueue = parameters.getAsObject(BatchSyncParam_1.BatchSyncParam.UploadResponseQueue);
        var recoveryQueue = parameters.getAsObject(BatchSyncParam_1.BatchSyncParam.RecoveryQueue);
        // Get required services
        var downloadAdapter = parameters.getAsObject(BatchSyncParam_1.BatchSyncParam.DownloadAdapter);
        var uploadAdapter = parameters.getAsObject(BatchSyncParam_1.BatchSyncParam.UploadAdapter);
        // Start process and load entities
        this.addTask(BatchSyncName_1.BatchSyncName.DownloadTask, BatchSyncDownloadTask_1.BatchSyncDownloadTask, startQueue);
        // Confirm load and save entities
        this.addTask(BatchSyncName_1.BatchSyncName.UploadTask, BatchSyncUploadTask_1.BatchSyncUploadTask, downloadResponseQueue);
        // Confirm save and close process
        this.addTask(BatchSyncName_1.BatchSyncName.CloseTask, BatchSyncCloseTask_1.BatchSyncCloseTask, uploadResponseQueue);
        // Recovery load and save
        this.addTask(BatchSyncName_1.BatchSyncName.RecoveryTask, BatchSyncRecoveryTask_1.BatchSyncRecoveryTask, recoveryQueue);
    }
}
exports.BatchSyncProcess = BatchSyncProcess;
//# sourceMappingURL=BatchSyncProcess.js.map