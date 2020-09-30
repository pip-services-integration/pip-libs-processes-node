let async = require('async');
let assert = require('chai').assert;

import { ProcessMockReferences } from "../mocks/ProcessMockReferences";
import { IMessageQueue} from "pip-services3-messaging-node";
import { KnownDescriptors, TaskHandler, ForwardMessageTask, ProcessParam } from "../../src";
import { Parameters } from "pip-services3-commons-node";

suite('ForwardMessageTask', () => {

    test('It_Should_Not_Be_Broken_During_ForwardMessageTask_Normal_Flow', (done) => {
        // Create references
        var references = new ProcessMockReferences([]);
        var inputQueue = references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue("Test.InputQueue"));
        var outputQueue1 = references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue("Test.OutputQueue1"));
        var outputQueue2 = references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue("Test.OutputQueue2"));

        // Create the task handler
        var handler = new TaskHandler(
            "Test",
            "Forward",
            ForwardMessageTask,
            inputQueue,
            references,
            Parameters.fromTuples(
                ProcessParam.OutputQueues, [ outputQueue1, outputQueue2 ]
            )
        );

        handler.beginListen();

        async.series([
            // Send a message into the input queue
            (callback) => {
                inputQueue.sendAsObject("123", "Test.TestMessage", "Just a test...", callback);
            },
            // Wait for messages to arrive and be processed
            (callback) => {
                setTimeout(callback, 50);
            },
            // Check for messages in the ouput queues
            (callback) => {
                outputQueue1.receive(null, 1000, (err, result) => {
                    assert.isNotNull(result);
                    callback(err);
                });
            },
            (callback) => {
                outputQueue2.receive(null, 1000, (err, result) => {
                    assert.isNotNull(result);
                    callback(err);
                });
            },
        ], (err) => {
            handler.close(null, done);
        });
    });
});