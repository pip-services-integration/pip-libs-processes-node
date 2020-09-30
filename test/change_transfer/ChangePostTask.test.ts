import { TaskHandler } from "../../src/logic/TaskHandler";
import { IRetriesClientV1 } from "pip-clients-retries-node";
import { ITempBlobsClientV1, DataEnvelopV1 } from "pip-clients-tempblobs-node";
import { IProcessStatesClient, ProcessStateV1, MessageV1, ProcessStatusV1 } from "pip-clients-processstates-node";
import { TestEntity } from "../../src/clients/TestEntity";
import { ChangesPollGenerator } from "../../src/generators/ChangesPollGenerator";
import { IMessageQueue } from "pip-services3-messaging-node/obj/src/queues/IMessageQueue";
import { TestAdapterMemoryClient } from "../../src/clients/TestAdapterMemoryClient";
import { ProcessMockReferences } from "../mocks/ProcessMockReferences";
import { KnownDescriptors, ClientParam, GeneratorParam, ChangesTransferParam, ChangePostTask, ProcessParam } from "../../src";
import { Parameters, StringConverter } from "pip-services3-commons-node";
import { MessageEnvelope } from "pip-services3-messaging-node";

let async = require('async');
let assert = require('chai').assert;

suite('ChangePostTask', () => {
    var _references: ProcessMockReferences;
    var _pollAdapter: TestAdapterMemoryClient;
    var _postAdapter: TestAdapterMemoryClient;
    var _queue: IMessageQueue;
    var _generator: ChangesPollGenerator<TestEntity, string>;
    var _taskHandler: TaskHandler;
    var _retriesClient: IRetriesClientV1;
    var _tempBlobsClient: ITempBlobsClientV1;

    var _processStatesClient: IProcessStatesClient;

    setup((done) => {
        _references = new ProcessMockReferences([]);

        _queue = _references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue("Framework.TestQueue"));

        _processStatesClient = _references.getOneRequired<IProcessStatesClient>(KnownDescriptors.ProcessStates);

        _pollAdapter = new TestAdapterMemoryClient(
            null,
            _references,
            Parameters.fromTuples(
                ClientParam.InitialNumberOfEntities, 5
            )
        );

        _postAdapter = new TestAdapterMemoryClient(
            null,
            _references,
            Parameters.fromTuples(
                ClientParam.InitialNumberOfEntities, 0
            )
        );

        _retriesClient = _references.getOneRequired<IRetriesClientV1>(KnownDescriptors.Retries);
        _tempBlobsClient = _references.getOneRequired<ITempBlobsClientV1>(KnownDescriptors.TempBlobs);

        _generator = new ChangesPollGenerator<TestEntity, string>(
            "TestGenerator", _queue, _references,
            Parameters.fromTuples(
                GeneratorParam.Interval, 200,
                GeneratorParam.MessageType, "Framework.TestChange",
                ChangesTransferParam.PollAdapter, _pollAdapter,
                ChangesTransferParam.EntitiesPerRequest, 2
            )
        );

        _taskHandler = new TaskHandler(
            "TestProcess",
            "TestTask",
            ChangePostTask,
            _queue,
            _references,
            Parameters.fromTuples(
                ProcessParam.IsInitial, true,
                ProcessParam.IsFinal, true,
                ChangesTransferParam.PostAdapter, _postAdapter
            )
        );

        done();
    });

    teardown((done) => {
        _queue.close(null, (err) => {
            _generator.close(null, (err) => {
                _taskHandler.close(null, (err) => {
                    done(err);
                });
            });
        });
    });

    test('It_Should_Not_Be_Broken_During_SingleChangePost', (done) => {
        _taskHandler.beginListen();

        var change = _pollAdapter.Entities[0];
        assert.isEmpty(_postAdapter.Entities);

        var envelop: DataEnvelopV1<TestEntity>;

        async.series([
            (callback) => {
                _tempBlobsClient.writeBlobConditional<TestEntity>(null, change, null, (err, result) => {
                    assert.isNull(err);
                    envelop = result;
                    callback(err);
                });
            },
            (callback) => {
                _queue.sendAsObject(null, "Test.ChangeNotify", envelop, (err) => {
                    assert.isNull(err);
                    callback(err);
                });
            },
            (callback) => {
                setTimeout(() => {
                    assert.equal(1, _postAdapter.Entities.length);
                    callback();
                }, 500);
            },
        ], done);
    });

    test('It_Should_Not_Be_broken_During_DuplicatePost', (done) => {
        _taskHandler.parameters.setAsObject(ChangesTransferParam.RetriesGroup, "Test");

        _taskHandler.beginListen();

        var change = _pollAdapter.Entities[0];

        assert.isEmpty(_postAdapter.Entities);

        var retryKey = change.id + "-" + StringConverter.toString(change.change_time);
        var envelop: any;

        async.series([
            (callback) => {
                _retriesClient.addRetry(null, "Test", retryKey, null, (err, retry) => {
                    assert.isNull(err);
                    callback(err);
                });
            },
            (callback) => {
                _tempBlobsClient.writeBlobConditional<TestEntity>(null, change, null, (err, result) => {
                    assert.isNull(err);
                    envelop = result;
                    callback(err);
                });
            },
            (callback) => {
                _queue.sendAsObject(null, "Test.ChangeNotify", envelop, (err) => {
                    assert.isNull(err);
                    callback(err);
                });
            },
            (callback) => {
                setTimeout(() => {
                    assert.isEmpty(_postAdapter.Entities);
                    callback();
                }, 500);
            },
        ], done);
    });

    test('It_Should_Move_Messages_To_Dead_After_Catch_Exceptions_During_ChangePostTask_Execution', (done) => {
        var task = new ChangePostTask<TestEntity, string>();

        var movedToDeadLetter = false;

        let mockQueue = <IMessageQueue>{
            getName(): string {
                return 'MockQueue';
            },
            moveToDeadLetter(message: MessageEnvelope, callback?: (err: any) => void): void {
                movedToDeadLetter = true;
                callback(null);
            },
        };

        var process: ProcessStateV1;
        var envelop: any;
        var change = _pollAdapter.Entities[0];
        change.id = "";

        async.series([
            (callback) => {
                _processStatesClient.startProcess(null,
                    "TestProcess", null, "TestTask", null, <MessageV1>{ correlation_id: '123' }, 60 * 1000, (err, state) => {
                        assert.isNull(err);
                        process = state;
                        callback(err);
                    });
            },
            (callback) => {
                _tempBlobsClient.writeBlobConditional(null, change, null, (err, result) => {
                    assert.isNull(err);
                    envelop = result;
                    callback(err);
                });
            },
            (callback) => {
                task.initialize("TestProcess",
                    "TestTask",
                    new MessageEnvelope(null, "Test.ChangeNotify", envelop),
                    mockQueue,
                    _references,
                    Parameters.fromTuples(
                        ProcessParam.RecoveryQueue, _queue,
                        ProcessParam.IsInitial, 'false'
                    ), (err) => {
                        assert.isNull(err);
                        callback(err);
                    });
            },
            (callback) => {
                task.processId = "Random Id";
                task.execute((err) => {
                    assert.isNull(err);
                    assert.isTrue(movedToDeadLetter);
                    callback(err);
                });
            },
            (callback) => {
                movedToDeadLetter = false;
                task = new ChangePostTask<TestEntity, string>();
                task.initialize("Sample.BatchSync",
                    "Close",
                    new MessageEnvelope(null, "Test.ChangeNotify", envelop),
                    mockQueue,
                    _references,
                    Parameters.fromTuples(
                        ProcessParam.RecoveryQueue, _queue,
                        ProcessParam.IsInitial, 'false'
                    ), (err) => {
                        assert.isNull(err);
                        callback(err);
                    });
            },
            (callback) => {
                _processStatesClient.completeProcess(null, process, (err) => {
                    assert.isNull(err);
                    assert.equal(process.status, ProcessStatusV1.Completed);
                    callback(err);
                });
            },
            (callback) => {
                task.processId = process.id;
                task.execute((err) => {
                    assert.isNull(err);
                    assert.isTrue(movedToDeadLetter);
                    callback(err);
                });
            },
        ], done);
    });

    test('It_Should_Delete_Entity_During_ChangePostTask_Execution', (done) => {
        var task = new ChangePostTask<TestEntity, string>();

        let mockQueue = <IMessageQueue>{
            getName(): string {
                return 'MockQueue';
            },
            complete(message: MessageEnvelope, callback?: (err: any) => void): void {
                callback(null);
            }
        };

        var process: ProcessStateV1;
        var envelop: any;
        var change = _pollAdapter.Entities[0];
        change.deleted = true;

        async.series([
            (callback) => {
                _processStatesClient.startProcess(null,
                    "TestProcess", null, "TestTask", null, <MessageV1>{ correlation_id: '123' }, 60 * 1000, (err, state) => {
                        assert.isNull(err);
                        process = state;
                        callback(err);
                    });
            },
            (callback) => {
                _tempBlobsClient.writeBlobConditional(null, change, null, (err, result) => {
                    assert.isNull(err);
                    envelop = result;
                    callback(err);
                });
            },
            (callback) => {
                task.initialize("TestProcess",
                    "TestTask",
                    new MessageEnvelope(null, "Test.ChangeNotify", envelop),
                    mockQueue,
                    _references,
                    Parameters.fromTuples(
                        ProcessParam.RecoveryQueue, _queue,
                        ProcessParam.IsInitial, 'false',
                        ChangesTransferParam.PostAdapter, _postAdapter
                    ), (err) => {
                        assert.isNull(err);
                        callback(err);
                    });
            },
            (callback) => {
                task.execute((err) => {
                    assert.isNull(err);
                    callback(err);
                });
            },
            (callback) => {
                _postAdapter.getOneById(null, change.id, (err, entity) => {
                    assert.isNull(err);
                    assert.isNull(entity);
                    callback(err);
                })
            },
        ], done);
    });

    test('It_Should_Update_Entity_During_ChangePostTask_Execution', (done) => {
        var task = new ChangePostTask<TestEntity, string>();

        let mockQueue = <IMessageQueue>{
            getName(): string {
                return 'MockQueue';
            },
            complete(message: MessageEnvelope, callback?: (err: any) => void): void {
                callback(null);
            }
        };

        var dateInPast = new Date(2016, 1, 1);
        var process: ProcessStateV1;
        var envelop: any;
        var change = _pollAdapter.Entities[0];
        change.create_time = dateInPast;

        async.series([
            (callback) => {
                _processStatesClient.startProcess(null,
                    "TestProcess", null, "TestTask", null, <MessageV1>{ correlation_id: '123' }, 60 * 1000, (err, state) => {
                        assert.isNull(err);
                        process = state;
                        callback(err);
                    });
            },
            (callback) => {
                _tempBlobsClient.writeBlobConditional(null, change, null, (err, result) => {
                    assert.isNull(err);
                    envelop = result;
                    callback(err);
                });
            },
            (callback) => {
                task.initialize("TestProcess",
                    "TestTask",
                    new MessageEnvelope(null, "Test.ChangeNotify", envelop),
                    mockQueue,
                    _references,
                    Parameters.fromTuples(
                        ProcessParam.RecoveryQueue, _queue,
                        ProcessParam.IsInitial, 'false',
                        ChangesTransferParam.PostAdapter, _postAdapter
                    ), (err) => {
                        assert.isNull(err);
                        callback(err);
                    });
            },
            (callback) => {
                task.execute((err) => {
                    assert.isNull(err);
                    callback(err);
                });
            },
            (callback) => {
                _postAdapter.getOneById(null, change.id, (err, entity) => {
                    assert.isNull(err);
                    assert.isNotNull(entity);
                    assert.equal(dateInPast.toISOString(), entity.create_time);
                    callback(err);
                })
            },
        ], done);
    });
});