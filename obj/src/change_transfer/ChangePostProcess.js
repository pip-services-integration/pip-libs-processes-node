"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangePostProcess = void 0;
const logic_1 = require("../logic");
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const ChangesTransferParam_1 = require("./ChangesTransferParam");
const ChangePostTask_1 = require("./ChangePostTask");
class ChangePostProcess extends logic_1.Process {
    constructor(processType, references, parameters) {
        super(processType, references, parameters);
        // Define post activities
        var postAdapter = parameters.get(ChangesTransferParam_1.ChangesTransferParam.PostAdapter1);
        postAdapter = postAdapter !== null && postAdapter !== void 0 ? postAdapter : parameters.get(ChangesTransferParam_1.ChangesTransferParam.PostAdapter);
        var transferQueue = parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.TransferQueue1);
        transferQueue = transferQueue !== null && transferQueue !== void 0 ? transferQueue : parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.TransferQueue);
        var postponeTimeout = parameters.get(ChangesTransferParam_1.ChangesTransferParam.PostponeTimeout);
        this.addTask('Post', ChangePostTask_1.ChangePostTask, transferQueue, -1, pip_services3_commons_node_1.Parameters.fromTuples(logic_1.ProcessParam.IsInitial, 'true', logic_1.ProcessParam.IsFinal, 'true', ChangesTransferParam_1.ChangesTransferParam.PostAdapter, postAdapter, ChangesTransferParam_1.ChangesTransferParam.PostponeTimeout, postponeTimeout));
    }
}
exports.ChangePostProcess = ChangePostProcess;
//# sourceMappingURL=ChangePostProcess.js.map