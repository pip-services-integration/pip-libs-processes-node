"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TransferProcess_1 = require("./TransferProcess");
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const ChangesTransferParam_1 = require("./ChangesTransferParam");
const GeneratorParam_1 = require("../generators/GeneratorParam");
const BatchesPollGenerator_1 = require("../generators/BatchesPollGenerator");
class BatchesTransferProcess extends TransferProcess_1.TransferProcess {
    constructor(processType, references, parameters) {
        super(processType, references, parameters);
        var transferQueue = this.parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.TransferQueue1);
        transferQueue = (transferQueue !== null && transferQueue !== void 0 ? transferQueue : this.parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.TransferQueue));
        // Define polling generator
        var pollAdapter = parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.PollAdapter);
        this._generator = new BatchesPollGenerator_1.BatchesPollGenerator(this.processType, transferQueue, references, pip_services3_commons_node_1.Parameters.fromTuples(GeneratorParam_1.GeneratorParam.MessageType, processType + '.Change', ChangesTransferParam_1.ChangesTransferParam.PollAdapter, pollAdapter).override(this.parameters));
    }
}
exports.BatchesTransferProcess = BatchesTransferProcess;
//# sourceMappingURL=BatchesTransferProcess.js.map