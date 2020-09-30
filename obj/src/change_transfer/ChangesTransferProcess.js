"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangesTransferProcess = void 0;
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const ChangesPollGenerator_1 = require("../generators/ChangesPollGenerator");
const GeneratorParam_1 = require("../generators/GeneratorParam");
const ChangesTransferParam_1 = require("./ChangesTransferParam");
const TransferProcess_1 = require("./TransferProcess");
class ChangesTransferProcess extends TransferProcess_1.TransferProcess {
    constructor(processType, references, parameters) {
        super(processType, references, parameters);
        var transferQueue = this.parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.TransferQueue1);
        transferQueue = transferQueue !== null && transferQueue !== void 0 ? transferQueue : this.parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.TransferQueue);
        // Define polling generator
        var pollAdapter = this.parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.PollAdapter);
        this._generator = new ChangesPollGenerator_1.ChangesPollGenerator(this.processType, transferQueue, references, pip_services3_commons_node_1.Parameters.fromTuples(GeneratorParam_1.GeneratorParam.MessageType, processType + '.Change', ChangesTransferParam_1.ChangesTransferParam.PollAdapter, pollAdapter).override(this.parameters));
    }
}
exports.ChangesTransferProcess = ChangesTransferProcess;
//# sourceMappingURL=ChangesTransferProcess.js.map