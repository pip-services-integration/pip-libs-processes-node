let async = require('async');
let assert = require('chai').assert;

import { ConfigParams, Schema } from 'pip-services3-commons-node';
import { Descriptor } from 'pip-services3-commons-node';
import { References } from 'pip-services3-commons-node';
import { Parameters } from 'pip-services3-commons-node';


import { Task } from '../../src/logic/Task';
import { MessageEnvelope, MemoryMessageQueue, IMessageQueue } from 'pip-services3-messaging-node';
import { ProcessMockReferences } from '../mocks/ProcessMockReferences';
import { ForwardMessageTask } from '../../src/logic/ForwardMessageTask';
import { KnownDescriptors } from '../../src/logic/KnownDescriptors';
import { TaskProcessStage } from '../../src';

suite('Abstract Task', () => {
    var _activity: Task;
    var _workflowType: string = "Test";
    var _activityType = "Forward";
    var _message: MessageEnvelope = new MessageEnvelope(null, null, null);
    var _references: ProcessMockReferences = new ProcessMockReferences([]);
    var _queue: MemoryMessageQueue;
    var _parameters: Parameters = new Parameters();

    setup((done) => {
        _queue = new MemoryMessageQueue();
        _activity = new ForwardMessageTask();
        _references.put(KnownDescriptors.messageQueue("Test.InputQueue"), _queue);
        _activity.initialize(_workflowType, _activityType, _message, _queue, _references, _parameters, done);
    });

    teardown((done) => {
        done();
    });

    test('It_Should_Throw_Exception_If_Activity_Type_Is_Null', (done) => {
        _activity = new ForwardMessageTask();
        _activity.initialize(_workflowType, null, _message, _queue, _references, _parameters, (err) => {
            assert.isNotNull(err);
            done();
        });
    });

    test('It_Should_Throw_Exception_If_Workflow_Type_Is_Null', (done) => {
        _activity = new ForwardMessageTask();
        _activity.initialize(null, _activityType, _message, _queue, _references, _parameters, (err) => {
            assert.isNotNull(err);
            done();
        });
    });

    test('It_Should_Throw_Exception_If_References_Is_Null', (done) => {
        _activity = new ForwardMessageTask();
        _activity.initialize(_workflowType, _activityType, _message, _queue, null, _parameters, (err) => {
            assert.isNotNull(err);
            done();
        });
    });

    test('It_Should_Initialize_Activity', (done) => {
        _activity = new ForwardMessageTask();
        _activity.initialize(_workflowType, _activityType, _message, _queue, _references, _parameters, (err) => {
            assert.isNull(err);
            assert.isNotNull(_activity);
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

        var activity = new ForwardMessageTask();

        async.series([
            (callback) => {
                activity.initialize(_workflowType, _activityType, _message, messageQueueMock, references, _parameters, (err) => {
                    assert.isNull(err);
                    callback();
                });
            },
            (callback) => {
                activity.sendMessage("Test.InputQueue", "Any _message", (err) => {
                    assert.isNull(err);
                    assert.equal(true, sent);
                    callback();
                })
            },
            (callback) => {
                activity.completeMessage((err) => {
                    assert.isNull(err);
                    assert.equal(true, completed);
                    callback();
                });
            },
            (callback) => {
                activity.abandonMessage((err) => {
                    assert.isNull(err);
                    assert.equal(true, abandoned);
                    callback();
                });
            },
            (callback) => {
                activity.moveMessageToDead((err) => {
                    assert.isNull(err);
                    assert.equal(true, moved);
                    callback();
                });
            }
        ], done);
    });

    test('It_Should_Throw_Exception_If_Message_Is_Null', (done) => {
        try {
            _activity.validateMessage(null, new Schema());
        }
        catch (err) {
            assert.equal('Message cannot be null', err.message);
        }

        done();
    });

    test('It_Should_Activate_Or_Start_Workflow', (done) => {
        _activity.activateOrStartProcessWithKey("Any key", (err, state) => {
            assert.isNull(err);
            done();
        });
    });

    test('It_Should_Throw_Exception_If_Workflow_Key_Is_Null', (done) => {
        _activity.activateOrStartProcessWithKey(null, (err, state) => {
            assert.isNotNull(err);
            done();
        })
    });

    test('It_Should_Throw_Exception_If_Workflow_Key_Is_Null_During_Workflow_Activation', (done) => {
        _activity.activateProcessWithKey(null, (err, state) => {
            assert.isNotNull(err);
            done();
        });
    });

    test('It_Should_Start_Workflow_And_Repeat_Workflow_Compensation', (done) => {
        async.series([
            (callback) => {
                _activity.activateOrStartProcessWithKey("Any key", (err, state) => {
                    assert.isNull(err);
                    callback();
                });
            },
            (callback) => {
                _activity.repeatProcessRecovery(null, (err) => {
                    assert.isNull(err);
                    assert.equal(TaskProcessStage.Processed, _activity.processStage);
                    callback();
                });
            },
        ], done);
    });

    test('It_Should_Start_Workflow_And_Fail_And_Continue_Workflow', (done) => {
        async.series([
            (callback) => {
                _activity.activateOrStartProcessWithKey("Any key", (err, state) => {
                    assert.isNull(err);
                    callback();
                });
            },
            (callback) => {
                _activity.failAndContinueProcess("Error _message", (err) => {
                    assert.isNull(err);
                    assert.equal(TaskProcessStage.Processed, _activity.processStage);
                    callback();
                });
            },
        ], done);
    });
    
    test('It_Should_Start_Workflow_And_Fail_And_Retry_Workflow', (done) => {
        async.series([
            (callback) => {
                _activity.activateOrStartProcessWithKey("Any key", (err, state) => {
                    assert.isNull(err);
                    callback();
                });
            },
            (callback) => {
                _activity.failAndRetryProcess("Error _message", (err) => {
                    assert.isNull(err);
                    assert.equal(TaskProcessStage.Processed, _activity.processStage);
                    callback();
                });
            },
        ], done);
    });
    
    test('It_Should_Start_Workflow_And_Abort_Workflow', (done) => {
        async.series([
            (callback) => {
                _activity.activateOrStartProcessWithKey("Any key", (err, state) => {
                    assert.isNull(err);
                    callback();
                });
            },
            (callback) => {
                _activity.abortProcess("Error _message", (err) => {
                    assert.isNull(err);
                    assert.equal(TaskProcessStage.Processed, _activity.processStage);
                    callback();
                });
            },
        ], done);
    });
    
    test('It_Should_Start_Workflow_And_Rollback_Workflow', (done) => {
        async.series([
            (callback) => {
                _activity.activateOrStartProcessWithKey("Any key", (err, state) => {
                    assert.isNull(err);
                    callback();
                });
            },
            (callback) => {
                _activity.rollbackProcess("Error _message", (err) => {
                    assert.isNull(err);
                    assert.equal(TaskProcessStage.Processed, _activity.processStage);
                    callback();
                });
            },
        ], done);
    });
       
    test('It_Should_Write_And_Read_Settings', (done) => {

        done();
    });
       
    test('It_Should_Add_Mapping_And_Map_Ids', (done) => {

        done();
    });
});

