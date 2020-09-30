let async = require('async');
let assert = require('chai').assert;

import { NullTask, KnownDescriptors, TaskHandler } from "../../src";
import { MockReferences } from "../mocks/MockReferences";
import { IMessageQueue } from "pip-services3-messaging-node";

suite('Null Task', () => {

    test('It_Should_Not_Be_Broken_During_NullTask_Normal_Flow', (done) => {
        // Create references
        var references = new MockReferences(null, null);
        var inputQueue = references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue("Test.InputQueue"));

        // Create the task handler
        var handler = new TaskHandler(
            "Test",
            "Null",
            typeof(NullTask), 
            inputQueue, 
            references,
            null
        );

        async.series([
            // Send message through the input queue
            (callback) => {
                inputQueue.sendAsObject("123", "Test.TestMessage", "Just a test...", callback);
            },
            (callback) => {
                setTimeout(() => {
                    handler.close(null, callback);
                }, 100);
            },
        ], done);
    });
});