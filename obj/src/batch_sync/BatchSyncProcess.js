"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Process_1 = require("../logic/Process");
const BatchSyncParam_1 = require("./BatchSyncParam");
const BatchSyncName_1 = require("./BatchSyncName");
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
        this.addTask(BatchSyncName_1.BatchSyncName.DownloadTask, startQueue);
        // Confirm load and save entities
        this.addTask(BatchSyncName_1.BatchSyncName.UploadTask, downloadResponseQueue);
        // Confirm save and close process
        this.addTask(BatchSyncName_1.BatchSyncName.CloseTask, uploadResponseQueue);
        // Recovery load and save
        this.addTask(BatchSyncName_1.BatchSyncName.RecoveryTask, recoveryQueue);
    }
}
exports.BatchSyncProcess = BatchSyncProcess;
//# sourceMappingURL=BatchSyncProcess.js.map