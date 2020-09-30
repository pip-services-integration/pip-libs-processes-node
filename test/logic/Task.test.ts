let async = require('async');
let assert = require('chai').assert;

import { ConfigParams, Schema } from 'pip-services3-commons-node';
import { Parameters } from 'pip-services3-commons-node';

import { Task } from '../../src/logic/Task';
import { MessageEnvelope, MemoryMessageQueue, IMessageQueue } from 'pip-services3-messaging-node';
import { ProcessMockReferences } from '../mocks/ProcessMockReferences';
import { ForwardMessageTask } from '../../src/logic/ForwardMessageTask';
import { KnownDescriptors } from '../../src/logic/KnownDescriptors';
import { TaskProcessStage } from '../../src';

suite('Abstract Task', () => {
    var _task: Task;
    var _processType: string = "Test";
    var _taskType = "Forward";
    var _message: MessageEnvelope = new MessageEnvelope(null, null, null);
    var _references: ProcessMockReferences;
    var _queue: MemoryMessageQueue;
    var _parameters: Parameters = new Parameters();

    setup((done) => {
        _queue = new MemoryMessageQueue();
        _task = new ForwardMessageTask();

        _references = new ProcessMockReferences([]);
        _references.put(KnownDescriptors.messageQueue("Test.InputQueue"), _queue);

        _task.initialize(_processType, _taskType, _message, _queue, _references, _parameters, done);
    });

    teardown((done) => {
        done();
    });

    test('It_Should_Throw_Exception_If_Task_Type_Is_Null', (done) => {
        _task = new ForwardMessageTask();
        _task.initialize(_processType, null, _message, _queue, _references, _parameters, (err) => {
            assert.isNotNull(err);
            done();
        });
    });

    test('It_Should_Throw_Exception_If_Process_Type_Is_Null', (done) => {
        _task = new ForwardMessageTask();
        _task.initialize(null, _taskType, _message, _queue, _references, _parameters, (err) => {
            assert.isNotNull(err);
            done();
        });
    });

    test('It_Should_Throw_Exception_If_References_Is_Null', (done) => {
        _task = new ForwardMessageTask();
        _task.initialize(_processType, _taskType, _message, _queue, null, _parameters, (err) => {
            assert.isNotNull(err);
            done();
        });
    });

    test('It_Should_Initialize_Task', (done) => {
        _task = new ForwardMessageTask();
        _task.initialize(_processType, _taskType, _message, _queue, _references, _parameters, (err) => {
            assert.isNull(err);
            assert.isNotNull(_task);
            done();
        });

    });

    test('It_Should_Handle_Messages', (done) => {
        var sent = false;
        var completed = false;
        var abandoned = false;
        var moved = false;

        let messageQueueMock: IMessageQueue = <IMessageQueue>{
            send(correlationId: string, envelope: MessageEnvelope, callback?: (err: any) => void) {
                sent = true;
                callback(null);
            },
            complete(message: MessageEnvelope, callback: (err: any) => void) {
                completed = true;
                callback(null);
            },
            abandon(message: MessageEnvelope, callback?: (err: any) => void) {
                abandoned = true;
                callback(null);
            },
            moveToDeadLetter(message: MessageEnvelope, callback?: (err: any) => void) {
                moved = true;
                callback(null);
            }
        };

        var references: ProcessMockReferences = new ProcessMockReferences([]);
        references.put(KnownDescriptors.messageQueue("Test.InputQueue"), messageQueueMock);

        var task = new ForwardMessageTask();

        async.series([
            (callback) => {
                task.initialize(_processType, _taskType, _message, messageQueueMock, references, _parameters, (err) => {
                    assert.isNull(err);
                    callback();
                });
            },
            (callback) => {
                task.sendMessage("Test.InputQueue", "Any _message", (err) => {
                    assert.isNull(err);
                    assert.equal(true, sent);
                    callback();
                })
            },
            (callback) => {
                task.completeMessage((err) => {
                    assert.isNull(err);
                    assert.equal(true, completed);
                    callback();
                });
            },
            (callback) => {
                task.abandonMessage((err) => {
                    assert.isNull(err);
                    assert.equal(true, abandoned);
                    callback();
                });
            },
            (callback) => {
                task.moveMessageToDead((err) => {
                    assert.isNull(err);
                    assert.equal(true, moved);
                    callback();
                });
            }
        ], done);
    });

    test('It_Should_Throw_Exception_If_Message_Is_Null', (done) => {
        try {
            _task.validateMessage(null, new Schema());
        }
        catch (err) {
            assert.equal('Message cannot be null', err.message);
        }

        done();
    });

    test('It_Should_Activate_Or_Start_Process', (done) => {
        _task.activateOrStartProcessWithKey("Any key", (err, state) => {
            assert.isNull(err);
            done();
        });
    });

    test('It_Should_Throw_Exception_If_Process_Key_Is_Null', (done) => {
        _task.activateOrStartProcessWithKey(null, (err, state) => {
            assert.isNotNull(err);
            done();
        })
    });

    test('It_Should_Throw_Exception_If_Process_Key_Is_Null_During_Process_Activation', (done) => {
        _task.activateProcessWithKey(null, (err, state) => {
            assert.isNotNull(err);
            done();
        });
    });

    test('It_Should_Start_Process_And_Repeat_Process_Recovery', (done) => {
        async.series([
            (callback) => {
                _task.activateOrStartProcessWithKey("Any key", (err, state) => {
                    assert.isNull(err);
                    callback();
                });
            },
            (callback) => {
                _task.repeatProcessRecovery(null, (err) => {
                    assert.isNull(err);
                    assert.equal(TaskProcessStage.Processed, _task.processStage);
                    callback();
                });
            },
        ], done);
    });

    test('It_Should_Start_Process_And_Fail_And_Continue_Process', (done) => {
        async.series([
            (callback) => {
                _task.activateOrStartProcessWithKey("Any key", (err, state) => {
                    assert.isNull(err);
                    callback();
                });
            },
            (callback) => {
                _task.failAndContinueProcess("Error _message", (err) => {
                    assert.isNull(err);
                    assert.equal(TaskProcessStage.Processed, _task.processStage);
                    callback();
                });
            },
        ], done);
    });

    test('It_Should_Start_Process_And_Fail_And_Retry_Process', (done) => {
        async.series([
            (callback) => {
                _task.activateOrStartProcessWithKey("Any key", (err, state) => {
                    assert.isNull(err);
                    callback();
                });
            },
            (callback) => {
                _task.failAndRetryProcess("Error _message", (err) => {
                    assert.isNull(err);
                    assert.equal(TaskProcessStage.Processed, _task.processStage);
                    callback();
                });
            },
        ], done);
    });

    test('It_Should_Start_Process_And_Abort_Process', (done) => {
        async.series([
            (callback) => {
                _task.activateOrStartProcessWithKey("Any key", (err, state) => {
                    assert.isNull(err);
                    callback();
                });
            },
            (callback) => {
                _task.abortProcess("Error _message", (err) => {
                    assert.isNull(err);
                    assert.equal(TaskProcessStage.Processed, _task.processStage);
                    callback();
                });
            },
        ], done);
    });

    test('It_Should_Start_Process_And_Rollback_Process', (done) => {
        async.series([
            (callback) => {
                _task.activateOrStartProcessWithKey("Any key", (err, state) => {
                    assert.isNull(err);
                    callback();
                });
            },
            (callback) => {
                _task.rollbackProcess("Error _message", (err) => {
                    assert.isNull(err);
                    assert.equal(TaskProcessStage.Processed, _task.processStage);
                    callback();
                });
            },
        ], done);
    });

    test('It_Should_Write_And_Read_Settings', (done) => {
        let settings = ConfigParams.fromTuples("param", "value");

        async.series([
            (callback) => {
                _task.activateOrStartProcessWithKey("Any key", (err, state) => {
                    assert.isNull(err);
                    callback();
                });
            },
            (callback) => {
                _task.writeSettings("Section", settings, (err, settings) => {
                    assert.isNull(err);
                    callback();
                });
            },
            (callback) => {
                _task.readSettings("Section", (err, result) => {
                    assert.isNull(err);
                    assert.equal(settings["param"], result["param"]);
                    callback();
                })
            },
        ], done);
    });

    test('It_Should_Add_Mapping_And_Map_Ids', (done) => {
        async.series([
            (callback) => {
                _task.activateOrStartProcessWithKey("Any key", (err, state) => {
                    assert.isNull(err);
                    callback();
                });
            },
            (callback) => {
                _task.addMapping("collection", "internalId", "externalId", null, (err) => {
                    assert.isNull(err);
                    callback();
                });
            },
            (callback) => {
                _task.mapToExternal("collection", "internalId", (err, externalId) => {
                    assert.isNull(err);
                    assert.equal("externalId", externalId);
                    callback();
                });
            },
            (callback) => {
                _task.mapToInternal("collection", "internalId", (err, internalId) => {
                    assert.isNull(err);
                    assert.isNull(internalId);
                    callback();
                });
            },
        ], done);
    });
});

