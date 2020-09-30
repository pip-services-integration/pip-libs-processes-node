import { ProcessMockReferences } from "../mocks/ProcessMockReferences";
import { IMessageQueue, MessageEnvelope } from "pip-services3-messaging-node";
import { KnownDescriptors, Process, ForwardMessageTask, ProcessParam, NullTask } from "../../src";
import { Parameters } from "pip-services3-commons-node";

let async = require('async');
let assert = require('chai').assert;

suite('Process', () => {

    test('It_Should_Not_Be_Broken_During_Process_Normal_Flow', (done) => {
        // Create all references
        var references = new ProcessMockReferences([]);
        var inputQueue = references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue("Test.InputQueue"));
        var outputQueue1 = references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue("Test.OutputQueue1"));
        var outputQueue2 = references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue("Test.OutputQueue2"));

        // Setup integration process
        var process = new Process("TestProcess", references)
            // Splits message into two queues
            .addTask<ForwardMessageTask>("Task1", ForwardMessageTask, inputQueue, 1, Parameters.fromTuples(
                ProcessParam.OutputQueues, [outputQueue1, outputQueue2]
            ))
            // Eats messages from one queue
            .addTask<NullTask>("Task2", NullTask, outputQueue1);

        process.beginListen();

        var messages: MessageEnvelope[] = [];

        async.series([
            // Send couple messages into the input queue        
            (callback) => {
                inputQueue.sendAsObject("123", "Test.TestMessage", "Just a test...", callback);
            },
            (callback) => {
                inputQueue.sendAsObject("124", "Test.TestMessage", "Just a test...", callback);
            },
            // Wait until process executes messages
            (callback) => {
                setTimeout(callback, 1000)
            },
            // Receive and verify messages from the output queue
            (callback) => {
                var cancel = false;

                async.whilst(
                    () => !cancel,
                    (callback) => {
                        outputQueue2.receive(null, 100, (err, result) => {
                            cancel = result == null;
                            if (result) messages.push(result);
                            callback(err);
                        })
                    },
                    (err) => {
                        callback(err);
                    }
                );
            },
            (callback) => {
                // Close the process
                process.close(null, callback);
            },
            // Test results
            (callback) => {
                assert.equal(messages.length, 2);
                assert.equal(messages[0].message_type, "Test.TestMessage");
                assert.equal(messages[0].correlation_id, "123");
                assert.equal(messages[0].message, "Just a test...");
                callback();
            },
        ], done);
    });
});