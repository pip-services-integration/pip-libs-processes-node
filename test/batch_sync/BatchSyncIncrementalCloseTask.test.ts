import { ProcessMockReferences } from "../mocks/ProcessMockReferences";
import { IMessageQueue } from "pip-services3-messaging-node";
import { TestAdapterMemoryClient } from "../../src/clients/TestAdapterMemoryClient";
import { TaskHandler } from "../../src/logic/TaskHandler";
import { IProcessStatesClient, ProcessStatusV1, MessageV1, ProcessStateV1 } from "pip-clients-processstates-node";
import { KnownDescriptors } from "../../src/logic/KnownDescriptors";
import { BatchSyncCloseTask } from "../../src/batch_sync/BatchSyncCloseTask";
import { Parameters } from "pip-services3-commons-node";
import { ProcessParam } from "../../src/logic/ProcessParam";
import { BatchSyncParam, RequestConfirmation } from "../../src";

let async = require('async');
let assert = require('chai').assert;

suite('BatchSyncIncrementalCloseTask', () => {
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
            "Close",
            BatchSyncCloseTask,
            _uploadResponseQueue,
            _references,
            Parameters.fromTuples(
                ProcessParam.RecoveryQueue, _recoveryQueue,
                BatchSyncParam.IncrementalChanges, true
            )
        );

        done();
    });

    teardown((done) => {
        done();
    });

    test('It_Should_Not_Be_Broken_During_BatchSyncCloseTask_Incremental_Flow', (done) => {
        _handler.beginListen();

        var processState: ProcessStateV1;
        var confirmation: RequestConfirmation;

        async.series([
            (callback) => {
                _processStatesClient.startProcess(null,
                    "Test.BatchSync", null, "Download", null, <MessageV1>{ correlation_id: '123' }, 60 * 1000, (err, state) => {
                        processState = state;
                        callback(err);
                    });
            },
            (callback) => {
                _processStatesClient.continueProcess(null, processState, callback);
            },
            (callback) => {
                // Request data load. It shall send confirmation that we intercept
                _downloadAdapter.downloadAll(processState.id, _downloadResponseQueue.getName(), processState.request_id, callback);
            },
            (callback) => {
                // Get the confirmation message
                _downloadResponseQueue.receive(null, 10000, (err, result) => {
                    confirmation = result.getMessageAsJson() as RequestConfirmation;
                    callback(err);
                });
            },
            (callback) => {
                // Request data upload. It shall send confirmation that will activate the task
                _uploadAdapter.uploadAll(processState.id, confirmation.blob_ids, _uploadResponseQueue.getName(), processState.request_id, callback);
            },
            (callback) => {
                // Wait for messages to arrive and be processed
                setTimeout(callback, 200);
            },
            (callback) => {
                // Check for completed process
                _processStatesClient.getProcessById(null, processState.id, (err, state) => {
                    assert.isNotNull(state);
                    assert.equal(ProcessStatusV1.Completed, state.status);
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