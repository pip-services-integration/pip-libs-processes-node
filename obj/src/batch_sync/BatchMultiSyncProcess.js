"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Process_1 = require("../logic/Process");
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const BatchSyncParam_1 = require("./BatchSyncParam");
const BatchMultiSyncParam_1 = require("./BatchMultiSyncParam");
const BatchSyncName_1 = require("./BatchSyncName");
class BatchMultiSyncProcess extends Process_1.Process {
    constructor(processType, references, parameters) {
        super(processType, references, parameters);
        if (parameters == null)
            throw new Error('Workflow parameters are not defined');
        // Get required queues
        var startQueue = parameters.get(BatchSyncParam_1.BatchSyncParam.StartQueue);
        var downloadResponseQueue = parameters.get(BatchSyncParam_1.BatchSyncParam.DownloadResponseQueue);
        var recoveryStartQueue = parameters.get(BatchSyncParam_1.BatchSyncParam.RecoveryQueue + 'Start');
        var targetAdapterCount = parameters.getAsInteger(BatchMultiSyncParam_1.BatchMultiSyncParam.UploadAdapterCount);
        var incremental = parameters.getAsBoolean(BatchSyncParam_1.BatchSyncParam.IncrementalChanges);
        // Get required services
        var downloadAdapter = parameters.get(BatchSyncParam_1.BatchSyncParam.DownloadAdapter);
        // Start workflow and load entities
        this.addTask(BatchSyncName_1.BatchSyncName.DownloadTask, startQueue, 1, pip_services3_commons_node_1.Parameters.fromTuples(BatchSyncParam_1.BatchSyncParam.RecoveryQueue, recoveryStartQueue));
        this.addTask(BatchSyncName_1.BatchSyncName.RecoveryTask, recoveryStartQueue);
        for (let i = 0; i < targetAdapterCount; i++) {
            var param = new pip_services3_commons_node_1.Parameters();
            param.put(BatchMultiSyncParam_1.BatchMultiSyncParam.UploadAdapterIndex, i);
            var uploadNotifyQueue = parameters.get(BatchMultiSyncParam_1.BatchMultiSyncParam.UploadNotifyQueue + i);
            var uploadResponseQueue = parameters.get(BatchSyncParam_1.BatchSyncParam.UploadResponseQueue + i);
            param.put(BatchSyncParam_1.BatchSyncParam.UploadResponseQueue, uploadResponseQueue);
            var recQueue = parameters.get(BatchSyncParam_1.BatchSyncParam.RecoveryQueue + i);
            param.put(BatchSyncParam_1.BatchSyncParam.RecoveryQueue, recQueue);
            if (incremental) {
                let uploadAdapter = parameters.get(BatchSyncParam_1.BatchSyncParam.UploadAdapter + i);
                param.put(BatchSyncParam_1.BatchSyncParam.UploadAdapter, uploadAdapter);
            }
            else {
                let uploadAdapter = parameters.get(BatchSyncParam_1.BatchSyncParam.UploadAdapter + i);
                param.put(BatchSyncParam_1.BatchSyncParam.UploadAdapter, uploadAdapter);
            }
            this.addTask(BatchSyncName_1.BatchSyncName.UploadTask + i, uploadNotifyQueue, 1, param);
            // Recovery load and save
            this.addTask(BatchSyncName_1.BatchSyncName.RecoveryTask + i, recQueue, 1, param);
            // Confirm load and save entities
            this.addTask(BatchSyncName_1.BatchSyncName.CloseTask + i, uploadResponseQueue, 1, param);
        }
        this.addTask('Queue Transfer', downloadResponseQueue, 1, parameters);
    }
}
exports.BatchMultiSyncProcess = BatchMultiSyncProcess;
//# sourceMappingURL=BatchMultiSyncProcess.js.map