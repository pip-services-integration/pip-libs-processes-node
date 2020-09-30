let async = require('async');

import { Task } from "./Task";
import { ProcessParam } from "./ProcessParam";
import { IMessageQueue } from "pip-services3-messaging-node";

export class ForwardMessageTask extends Task {
    constructor() {
        super();
    }

    public execute(callback: (err: any) => void): void {
        var initial = this._parameters.getAsBooleanWithDefault(ProcessParam.IsInitial, true);
        var final = this._parameters.getAsBooleanWithDefault(ProcessParam.IsFinal, true);
        var queues = this._parameters.getAsArray(ProcessParam.OutputQueues);

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
                async.each(queues, (queue: IMessageQueue, callback: (err: any) => void) => {
                    this._logger.info(this.processId, 'Forwarding %s to %s', this.message, queue);
                    queue.send(this.processId, this.message, callback);
                }, (err: any) => {
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
            if (callback) callback(err);
        })
    }
}