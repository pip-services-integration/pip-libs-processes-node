"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SequenceTransferProcess_1 = require("./SequenceTransferProcess");
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const GeneratorParam_1 = require("../generators/GeneratorParam");
const ChangesTransferParam_1 = require("./ChangesTransferParam");
const ChangesPollGenerator_1 = require("../generators/ChangesPollGenerator");
class ChangesSequenceTransferProcess extends SequenceTransferProcess_1.SequenceTransferProcess {
    constructor(processType, references, parameters) {
        super(processType, references, parameters);
        // this sub-class uses _pollAdapter from the SequenceTransferWorkflow class and it is required here
        if (this._pollAdapter == null)
            throw new Error('PollAdapter is not defined or doesn\'t implement IReadWrite client interface');
        this._generator = new ChangesPollGenerator_1.ChangesPollGenerator(this.processType, this._transferQueues[0], this._references, pip_services3_commons_node_1.Parameters.fromTuples(GeneratorParam_1.GeneratorParam.MessageType, this.processType + '.Change', ChangesTransferParam_1.ChangesTransferParam.PollAdapter, this._pollAdapter).override(parameters));
    }
}
exports.ChangesSequenceTransferProcess = ChangesSequenceTransferProcess;
//# sourceMappingURL=ChangesSequenceTransferProcess.js.map