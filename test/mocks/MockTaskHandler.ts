let async = require('async');

import { ITaskHandler, TaskHandler, Task } from "../../src";
import { MessageEnvelope, IMessageQueue } from "pip-services3-messaging-node";
import { IMockTaskHandler } from "./IMockTaskHandler";
import { References, Parameters } from "pip-services3-commons-node";

export class MockTaskHandler extends TaskHandler implements IMockTaskHandler {
    public receivedMessages: MessageEnvelope[] = [];

    constructor(queue: IMessageQueue) {
        super("Process Type", "Task Type", Task, queue, References.fromTuples(), Parameters.fromTuples());
    }

    receiveMessage(envelope: MessageEnvelope, queue: IMessageQueue, callback: (err: any) => void) {
        // add delays to simulate message processing time
        this.receivedMessages.push(envelope);
        if (callback) setTimeout(callback, 100);
    }

    beginListen(): void {
        async.whilst(
            () => !this._cancel,
            (callback) => {
                async.series([
                    (callback) => {
                        this.queue.listen(null, this);
                        callback();
                    },
                    (callback) => {
                        setTimeout(() => {
                            callback();
                        }, 100);
                    }], (err) => {
                        callback(err);
                    }
                )
            }
        );
    }
}