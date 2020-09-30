"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SequenceTransferProcess = void 0;
let async = require('async');
const Process_1 = require("../logic/Process");
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const ChangesTransferParam_1 = require("./ChangesTransferParam");
const ProcessParam_1 = require("../logic/ProcessParam");
const ChangePostTask_1 = require("./ChangePostTask");
class SequenceTransferProcess extends Process_1.Process {
    constructor(processType, references, parameters) {
        super(processType, references, parameters);
        this._postAdapters = [];
        this._transferQueues = [];
        if (parameters == null)
            throw new Error('Process parameters are not defined');
        this.defineSource();
        this.defineDestinations();
        this.createTasks();
    }
    setParameters(parameters) {
        super.setParameters(parameters);
        // Update generator parameters
        if (this._generator != null)
            this._generator.setParameters(parameters);
    }
    defineSource() {
        this._pollAdapter = this.parameters.get(ChangesTransferParam_1.ChangesTransferParam.PollAdapter);
        // BEaton: my guess is that _pollAdapter is defined here so the two current subclasses can use it directly.
        //  But some SequenceTransfer processes transfer from a queue directly, and don't need a poll adapter. So
        //  don't choke if it doesn't exist (those that need it, will need to define it, and those that don't, won't)
        // if (_pollAdapter == null)
        //     throw new ArgumentException('PollAdapter is not defined or doesn't implement IReadWrite client interface');
    }
    defineDestinations() {
        // Clean up previous settings
        this._postAdapters = [];
        this._transferQueues = [];
        // Define adapter and queue for the 1st system
        var postAdapter = this.parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.PostAdapter);
        postAdapter = postAdapter !== null && postAdapter !== void 0 ? postAdapter : this.parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.PostAdapter1);
        if (postAdapter == null)
            throw new Error('PostAdapter1 is not defined or doesn\'t implement IReadWriteClient interface');
        var transferQueue = this.parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.TransferQueue1);
        transferQueue = transferQueue !== null && transferQueue !== void 0 ? transferQueue : this.parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.TransferQueue);
        if (transferQueue == null)
            throw new Error('TransferQueue1 is not defined');
        this._postAdapters.push(postAdapter);
        this._transferQueues.push(transferQueue);
        // Define adapter and queue for the 2nd system
        postAdapter = this.parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.PostAdapter2);
        transferQueue = this.parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.TransferQueue2);
        if (postAdapter == null && transferQueue != null)
            throw new Error('PostAdapter2 is not defined');
        else if (postAdapter != null && transferQueue == null)
            throw new Error('TransferQueue2 is not defined');
        else if (postAdapter != null && transferQueue != null) {
            this._postAdapters.push(postAdapter);
            this._transferQueues.push(transferQueue);
        }
        // Define adapter and queue for the 3rd system
        postAdapter = this.parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.PostAdapter3);
        transferQueue = this.parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.TransferQueue3);
        if (postAdapter == null && transferQueue != null)
            throw new Error('PostAdapter3 is not defined');
        else if (postAdapter != null && transferQueue == null)
            throw new Error('TransferQueue3 is not defined');
        else if (postAdapter != null && transferQueue != null) {
            if (this._postAdapters.length < 2)
                throw new Error('PostAdapter2 and TransferQueue2 are not defined');
            this._postAdapters.push(postAdapter);
            this._transferQueues.push(transferQueue);
        }
    }
    createTasks() {
        for (var index = 0; index < this._transferQueues.length; index++) {
            var initial = index == 0;
            var final = index == (this._transferQueues.length - 1);
            var parameters = pip_services3_commons_node_1.Parameters.fromTuples(ProcessParam_1.ProcessParam.IsInitial, initial.toString(), ProcessParam_1.ProcessParam.IsFinal, final.toString(), ChangesTransferParam_1.ChangesTransferParam.ProcessKeyPrefix, '', ChangesTransferParam_1.ChangesTransferParam.PostAdapter, this._postAdapters[index], ChangesTransferParam_1.ChangesTransferParam.TransferQueue, !final ? this._transferQueues[index + 1] : null);
            this.addTask('Post' + (index + 1), ChangePostTask_1.ChangePostTask, this._transferQueues[index], -1, parameters);
        }
    }
    beginListen() {
        super.beginListen();
        if (this._generator != null)
            this._generator.beginExecute();
    }
    close(correlationId, callback) {
        async.series([
            (callback) => {
                if (this._generator != null) {
                    this._generator.close(correlationId, callback);
                    return;
                }
                callback();
            },
            (callback) => {
                super.close(correlationId, callback);
            }
        ], callback);
    }
}
exports.SequenceTransferProcess = SequenceTransferProcess;
//# sourceMappingURL=SequenceTransferProcess.js.map