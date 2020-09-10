"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logic_1 = require("../logic");
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const ChangesTransferParam_1 = require("./ChangesTransferParam");
class TransferProcess extends logic_1.Process {
    constructor(processType, references, parameters) {
        super(processType, references, parameters);
        // Define post activities
        var postAdapter = this.parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.PostAdapter1);
        postAdapter = (postAdapter !== null && postAdapter !== void 0 ? postAdapter : this.parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.PostAdapter));
        var transferQueue = this.parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.TransferQueue1);
        transferQueue = (transferQueue !== null && transferQueue !== void 0 ? transferQueue : this.parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.TransferQueue));
        this.addTask("Post", transferQueue, -1, pip_services3_commons_node_1.Parameters.fromTuples(logic_1.ProcessParam.IsInitial, true, logic_1.ProcessParam.IsFinal, true, ChangesTransferParam_1.ChangesTransferParam.PostAdapter, postAdapter));
    }
    setParameters(parameters) {
        super.setParameters(parameters);
        // Update generator 
        if (this._generator != null)
            this._generator.setParameters(parameters);
    }
    beginListen() {
        super.beginListen();
        this._generator.beginExecute();
    }
    close(correlationId, callback) {
        this._generator.close(correlationId, (err) => {
            super.close(correlationId, callback);
        });
    }
}
exports.TransferProcess = TransferProcess;
TransferProcess._defaultParameters = pip_services3_commons_node_1.Parameters.fromTuples(ChangesTransferParam_1.ChangesTransferParam.SendToUpdateAsyncOnly, false);
//# sourceMappingURL=TransferProcess.js.map