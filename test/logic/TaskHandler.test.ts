let _ = require('lodash');
let async = require('async');
let assert = require('chai').assert;

import { Process, TestEntityGenerator } from "../../src";
import { IMessageQueue, MemoryMessageQueue, MessageEnvelope } from "pip-services3-messaging-node";
import { IReferences } from "pip-services3-commons-node";
import { ILogger } from "pip-services3-components-node";
import { IMockTaskHandler } from "../mocks/IMockTaskHandler";
import { MockTaskHandler } from "../mocks/MockTaskHandler";

suite('Abstract Task', () => {
    var _process: Process;
    var _entityGenerator: TestEntityGenerator;
    var _messageQueue: IMessageQueue;

    var _moqReferences: IReferences;
    var _moqLogger: ILogger;
    var _moqTaskHandler1: IMockTaskHandler;
    var _moqTaskHandler2: IMockTaskHandler;
    var _moqTaskHandler3: IMockTaskHandler;

    setup((done) => {
        _entityGenerator = new TestEntityGenerator();
        _messageQueue = new MemoryMessageQueue();

        _moqTaskHandler1 = new MockTaskHandler(_messageQueue);
        _moqTaskHandler2 = new MockTaskHandler(_messageQueue);
        _moqTaskHandler3 = new MockTaskHandler(_messageQueue);

        _process = new Process("TestProcess", _moqReferences);
        _process.addTaskHandler(_moqTaskHandler1);
        _process.addTaskHandler(_moqTaskHandler2);
        _process.addTaskHandler(_moqTaskHandler3);

        done();
    });

    teardown((done) => {
        done();
    });

    test('It_Should_Process_All_Same_Messages_Using_Available_Task_Handlers', (done) => {
        var messageEnvelop = new MessageEnvelope(null, "Test.Entity", JSON.stringify(_entityGenerator.create()));

        _process.beginListen();

        async.series([
            (callback) => {
                async.times(3, (n, next) => {
                    _messageQueue.send(null, messageEnvelop, (err) => {
                        next(err);
                    });
                }, callback);
            },
            (callback) => {
                // wait queue messages processed
                let count = -1;

                async.whilst(
                    () => count != 0,
                    (callback) => {
                        async.series([
                            (callback) => {
                                _messageQueue.readMessageCount((err, cnt) => {
                                    count = cnt;
                                    callback();
                                });
                            },
                            (callback) => {
                                setTimeout(() => {
                                    callback();
                                }, 10);
                            }], (err) => {
                                callback(err);
                            }
                        )
                    },
                    callback
                );
            },
            (callback) => {
                setTimeout(() => {
                    assert.isAbove(_moqTaskHandler1.receivedMessages.length, 0);
                    assert.isAbove(_moqTaskHandler2.receivedMessages.length, 0);
                    assert.isAbove(_moqTaskHandler3.receivedMessages.length, 0);
                    callback();
                }, 100);
            },
        ], (err) => {
            _process.close(null, done);
        });
    });

    test('It_Should_Process_All_Different_Messages_Using_Available_Task_Handlers', (done) => {
        var messageEnvelop1 = new MessageEnvelope(null, "Test.Entity", JSON.stringify(_entityGenerator.create()));
        var messageEnvelop2 = new MessageEnvelope(null, "Test.Entity", JSON.stringify(_entityGenerator.create()));
        var messageEnvelop3 = new MessageEnvelope(null, "Test.Entity", JSON.stringify(_entityGenerator.create()));

        _process.beginListen();

        async.series([
            (callback) => {
                _messageQueue.send(null, messageEnvelop1, callback);
            },
            (callback) => {
                _messageQueue.send(null, messageEnvelop2, callback);
            },
            (callback) => {
                _messageQueue.send(null, messageEnvelop3, callback);
            },
            (callback) => {
                // wait queue messages processed
                let count = -1;

                async.whilst(
                    () => count != 0,
                    (callback) => {
                        async.series([
                            (callback) => {
                                _messageQueue.readMessageCount((err, cnt) => {
                                    count = cnt;
                                    callback();
                                });
                            },
                            (callback) => {
                                setTimeout(() => {
                                    callback();
                                }, 10);
                            }], (err) => {
                                callback(err);
                            }
                        )
                    },
                    callback
                );
            },
            (callback) => {
                setTimeout(() => {
                    // at least every task handler should receive one of the message
                    let messages = [messageEnvelop1, messageEnvelop2, messageEnvelop3];
                    assert.isNotEmpty(_.intersection(_moqTaskHandler1.receivedMessages, messages));
                    assert.isNotEmpty(_.intersection(_moqTaskHandler2.receivedMessages, messages));
                    assert.isNotEmpty(_.intersection(_moqTaskHandler3.receivedMessages, messages));
                    callback();
                }, 100);
            }
        ], (err) => {
            _process.close(null, done);
        });
    });
});