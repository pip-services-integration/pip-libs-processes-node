import { ProcessMockReferences } from "../mocks/ProcessMockReferences";
import { IMessageQueue, MessageEnvelope } from "pip-services3-messaging-node";
import { TestAdapterMemoryClient } from "../../src/clients/TestAdapterMemoryClient";
import { TaskHandler } from "../../src/logic/TaskHandler";
import { IProcessStatesClient, MessageV1, ProcessStateV1, ProcessStatusV1 } from "pip-clients-processstates-node";
import { BatchSyncRecoveryTask } from "../../src/batch_sync/BatchSyncRecoveryTask";
import { Parameters } from "pip-services3-commons-node";
import { ProcessParam } from "../../src/logic/ProcessParam";
import { KnownDescriptors } from "../../src/logic/KnownDescriptors";
import { BatchSyncParam } from "../../src/batch_sync/BatchSyncParam";
import { BatchSyncMessage } from "../../src/batch_sync/BatchSyncMessage";
import { RequestConfirmation } from "../../src/data/RequestConfirmation";
import { TestEntity } from "../../src/clients/TestEntity";

let async = require('async');
let assert = require('chai').assert;

suite('BatchSyncRecoveryTask', () => {
    var _references: ProcessMockReferences;
    var _startQueue: IMessageQueue;
    var _downloadResponseQueue: IMessageQueue;
    var _uploadResponseQueue: IMessageQueue;
    var _recoveryQueue: IMessageQueue;
    var _downloadAdapter: TestAdapterMemoryClient;
    var _uploadAdapter: TestAdapterMemoryClient;
    var _handler: TaskHandler;
    var _processStatesClient: IProcessStatesClient;

    setup((done) => {
        _references = new ProcessMockReferences([]);

        // Define message queues
        _startQueue = _references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue("Start"));
        _downloadResponseQueue = _references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue("DownloadResponse"));
        _uploadResponseQueue = _references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue("UploadResponse"));
        _recoveryQueue = _references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue("Recovery"));

        // Adapter where entities will be downloaded from
        _downloadAdapter = new TestAdapterMemoryClient(null, _references, null);

        // Adapter where entities will be uploaded to
        _uploadAdapter = new TestAdapterMemoryClient([], _references, null);

        _processStatesClient = _references.getOneRequired<IProcessStatesClient>(KnownDescriptors.ProcessStates);

        // Create the task handler
        _handler = new TaskHandler(
            "Sample.BatchSync",
            "Recovery",
            BatchSyncRecoveryTask,
            _recoveryQueue,
            _references,
            Parameters.fromTuples(
                BatchSyncParam.DownloadAdapter, _downloadAdapter,
                BatchSyncParam.UploadAdapter, _uploadAdapter,
                BatchSyncParam.DownloadResponseQueue, _downloadResponseQueue,
                BatchSyncParam.UploadResponseQueue, _uploadResponseQueue,
                ProcessParam.RecoveryTimeout, 0
            )
        );

        done();
    });

    teardown((done) => {
        done();
    });

    test('It_Should_Download_During_BatchSyncRecoveryTask_Normal_Flow', (done) => {
        _handler.beginListen();

        var processState: ProcessStateV1;

        async.series([
            // Start process
            (callback) => {
                _processStatesClient.startProcess(null,
                    "Test.BatchSync", null, "Recovery", null, <MessageV1>{ correlation_id: '123' }, 60 * 1000, (err, state) => {
                        processState = state;
                        callback(err);
                    });
            },
            (callback) => {
                _processStatesClient.continueProcess(null, processState, callback);
            },
            // Send recovery message
            (callback) => {
                _recoveryQueue.sendAsObject(processState.id, BatchSyncMessage.RecoveryDownload, null, callback);
            },
            (callback) => {
                // Wait for messages to arrive and be processed
                setTimeout(callback, 100);
            },
            (callback) => {
                // Get the recovery message
                _downloadResponseQueue.receive(null, 10000, (err, result) => {
                    assert.isNull(err);
                    assert.isNotNull(result);

                    var confirmation = result.getMessageAsJson() as RequestConfirmation;
                    assert.isNotNull(confirmation);
                    assert.isTrue(confirmation.successful);
                    assert.isNotNull(confirmation.blob_ids);
                    assert.isNotEmpty(confirmation.blob_ids);
                    callback(err);
                });
            },
        ], (err) => {
            _handler.close(null, (err1) => {
                done(err ?? err1);
            });
        });
    });

    test('It_Should_Do_IncrementalDownload_BatchSyncRecoveryTask_Normal_Flow', (done) => {
        _handler.setParameters(
            Parameters.fromTuples(
                BatchSyncParam.DownloadAdapter, _downloadAdapter,
                BatchSyncParam.UploadAdapter, _uploadAdapter,
                BatchSyncParam.DownloadResponseQueue, _downloadResponseQueue,
                BatchSyncParam.UploadResponseQueue, _uploadResponseQueue,
                ProcessParam.RecoveryTimeout, 0,
                BatchSyncParam.IncrementalChanges, true
            )
        );

        _handler.beginListen();

        var processState: ProcessStateV1;

        async.series([
            // Start process
            (callback) => {
                _processStatesClient.startProcess(null,
                    "Test.BatchSync", null, "Recovery", null, <MessageV1>{ correlation_id: '123' }, 60 * 1000, (err, state) => {
                        processState = state;
                        callback(err);
                    });
            },
            (callback) => {
                _processStatesClient.continueProcess(null, processState, callback);
            },
            // Send recovery message
            (callback) => {
                _recoveryQueue.sendAsObject(processState.id, BatchSyncMessage.RecoveryDownload, null, callback);
            },
            (callback) => {
                // Wait for messages to arrive and be processed
                setTimeout(callback, 100);
            },
            (callback) => {
                // Get the recovery message
                _downloadResponseQueue.receive(null, 10000, (err, result) => {
                    assert.isNull(err);
                    assert.isNotNull(result);

                    var confirmation = result.getMessageAsJson() as RequestConfirmation;
                    assert.isNotNull(confirmation);
                    assert.isTrue(confirmation.successful);
                    assert.isNotNull(confirmation.blob_ids);
                    assert.isNotEmpty(confirmation.blob_ids);
                    callback(err);
                });
            },
        ], (err) => {
            _handler.close(null, (err1) => {
                done(err ?? err1);
            });
        });
    });

    test('It_Should_Move_To_Dead_Letters_During_BatchSyncRecoveryTask_Bad_Flow', (done) => {
        var task = new BatchSyncRecoveryTask<TestEntity>();
        var processState: ProcessStateV1;

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

        async.series([
            (callback) => {
                _processStatesClient.startProcess(null,
                    "Test.BatchSync", null, "Download", null, <MessageV1>{ correlation_id: '123' }, 60 * 1000, (err, state) => {
                        processState = state;
                        callback(err);
                    });
            },
            (callback) => {
                task.initialize("Sample.BatchSync",
                    "Close",
                    new MessageEnvelope(null, null, null),
                    mockQueue,
                    _references,
                    Parameters.fromTuples(
                        ProcessParam.RecoveryQueue, _recoveryQueue
                    ), (err) => {
                        task.processId = "Random Id";
                        callback(err);
                    });
            },
            (callback) => {
                task.execute((err) => {
                    assert.isNull(err);
                    assert.isTrue(movedToDeadLetter);
                    callback(err);
                });
            },
            (callback) => {
                movedToDeadLetter = false;
                task = new BatchSyncRecoveryTask<TestEntity>();
                task.initialize("Sample.BatchSync",
                    "Close",
                    new MessageEnvelope(null, null, null),
                    mockQueue,
                    _references,
                    Parameters.fromTuples(
                        ProcessParam.RecoveryQueue, _recoveryQueue
                    ), callback);
            },
            (callback) => {
                _processStatesClient.completeProcess(null, processState, (err) => {
                    assert.isNull(err);
                    assert.equal(processState.status, ProcessStatusV1.Completed);
                    callback(err);
                });
            },
            (callback) => {
                task.processId = processState.id;
                task.execute((err) => {
                    assert.isNull(err);
                    assert.isTrue(movedToDeadLetter);
                    callback(err);
                });
            },
        ], done);
    });

    test('It_Should_Move_To_Dead_Letters_After_BatchSyncRecoveryTask_Fail', (done) => {
        _handler.beginListen();

        var processState: ProcessStateV1;
        var confirmation: RequestConfirmation;

        async.series([
            // Start process
            (callback) => {
                _processStatesClient.startProcess(null,
                    "Test.BatchSync", null, "Recovery", null, <MessageV1>{ correlation_id: '123' }, 60 * 1000, (err, state) => {
                        processState = state;
                        callback(err);
                    });
            },
            (callback) => {
                _processStatesClient.continueProcess(null, processState, callback);
            },
            // Request data Download. It shall send recovery that we intercept
            (callback) => {
                _downloadAdapter.downloadAll(processState.id, _downloadResponseQueue.getName(), processState.request_id, callback);
            },
            (callback) => {
                // Get the recovery message
                _downloadResponseQueue.receive(null, 10000, (err, result) => {
                    assert.isNull(err);
                    confirmation = result.getMessageAsJson() as RequestConfirmation;
                    callback(err);
                });
            },
            // Send recovery message
            (callback) => {
                _recoveryQueue.sendAsObject(processState.id, null, confirmation.blob_ids, callback);
            },
            // Get the recovery message
            (callback) => {
                _uploadResponseQueue.receive(null, 200, (err, result) => {
                    assert.isNull(err);
                    assert.isNull(result);
                    callback(err);
                });
            },
        ], (err) => {
            _handler.close(null, (err1) => {
                done(err ?? err1);
            });
        });
    });
});