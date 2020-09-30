"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForwardMessageTask = void 0;
let async = require('async');
const Task_1 = require("./Task");
const ProcessParam_1 = require("./ProcessParam");
class ForwardMessageTask extends Task_1.Task {
    constructor() {
        super();
    }
    execute(callback) {
        var initial = this._parameters.getAsBooleanWithDefault(ProcessParam_1.ProcessParam.IsInitial, true);
        var final = this._parameters.getAsBooleanWithDefault(ProcessParam_1.ProcessParam.IsFinal, true);
        var queues = this._parameters.getAsArray(ProcessParam_1.ProcessParam.OutputQueues);
        async.series([
            // Start or activate process
            (callback) => {
                if (initial)
                    this.startProcess(null, callback);
                else
                    this.activateProcess(null, callback);
            },
            // Forward all messages
            (callback) => {
                async.each(queues, (queue, callback) => {
                    this._logger.info(this.processId, 'Forwarding %s to %s', this.message, queue);
                    queue.send(this.processId, this.message, callback);
                }, (err) => {
                    callback(err);
                });
            },
            // Continue or complete process
            (callback) => {
                if (final)
                    this.completeProcess(callback);
                else
                    this.continueProcess(callback);
            }
        ], (err) => {
            if (callback)
                callback(err);
        });
    }
}
exports.ForwardMessageTask = ForwardMessageTask;
//# sourceMappingURL=ForwardMessageTask.js.map