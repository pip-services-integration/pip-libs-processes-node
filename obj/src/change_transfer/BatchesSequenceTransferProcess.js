"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const SequenceTransferProcess_1 = require("./SequenceTransferProcess");
const BatchesPollGenerator_1 = require("../generators/BatchesPollGenerator");
const GeneratorParam_1 = require("../generators/GeneratorParam");
const ChangesTransferParam_1 = require("./ChangesTransferParam");
class BatchesSequenceTransferProcess extends SequenceTransferProcess_1.SequenceTransferProcess {
    constructor(workflowType, references, parameters) {
        super(workflowType, references, parameters);
        // this sub-class uses _pollAdapter from the SequenceTransferWorkflow class and it is required here
        if (this._pollAdapter == null)
            throw new Error('PollAdapter is not defined or doesn\'t implement IReadWrite client interface');
        this._generator = new BatchesPollGenerator_1.BatchesPollGenerator(this.processType, this._transferQueues[0], this._references, pip_services3_commons_node_1.Parameters.fromTuples(GeneratorParam_1.GeneratorParam.MessageType, this.processType + '.Change', ChangesTransferParam_1.ChangesTransferParam.PollAdapter, this._pollAdapter).override(this.parameters));
    }
}
exports.BatchesSequenceTransferProcess = BatchesSequenceTransferProcess;
//# sourceMappingURL=BatchesSequenceTransferProcess.js.map