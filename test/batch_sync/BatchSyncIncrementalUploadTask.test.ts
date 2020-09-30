import { TaskHandler } from "../../src/logic/TaskHandler";
import { IProcessStatesClient, MessageV1, ProcessStateV1, ProcessStatusV1 } from "pip-clients-processstates-node";
import { KnownDescriptors } from "../../src/logic/KnownDescriptors";
import { TestAdapterMemoryClient } from "../../src/clients/TestAdapterMemoryClient";
import { IMessageQueue, MessageEnvelope } from "pip-services3-messaging-node";
import { ProcessMockReferences } from "../mocks/ProcessMockReferences";
import { BatchSyncUploadTask } from "../../src/batch_sync/BatchSyncUploadTask";
import { Parameters } from "pip-services3-commons-node";
import { BatchSyncParam } from "../../src/batch_sync/BatchSyncParam";
import { ProcessParam } from "../../src/logic/ProcessParam";
import { RequestConfirmation } from "../../src/data/RequestConfirmation";
import { TestEntity } from "../../src/clients/TestEntity";

let async = require('async');
let assert = require('chai').assert;

suite('BatchSyncIncrementalUploadTask', () => {
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
            "Upload",
            BatchSyncUploadTask,
            _downloadResponseQueue,
            _references,
            Parameters.fromTuples(
                BatchSyncParam.UploadAdapter, _uploadAdapter,
                BatchSyncParam.UploadResponseQueue, _uploadResponseQueue,
                ProcessParam.RecoveryQueue, _recoveryQueue,
                ProcessParam.RecoveryTimeout, 0,
                BatchSyncParam.IncrementalChanges, true
            )
        );

        done();
    });

    teardown((done) => {
        done();
    });

    test('It_Should_Not_Be_Broken_During_BatchSyncUploadTask_Incremental_Uploading', (done) => {
        _handler.beginListen();

        var processState: ProcessStateV1;

        async.series([
            // Start process
            (callback) => {
                _processStatesClient.startProcess(null,
                    "Test.BatchSync", null, "Upload", null, <MessageV1>{ correlation_id: '123' }, 60 * 1000, (err, state) => {
                        processState = state;
                        callback(err);
                    });
            },
            (callback) => {
                _processStatesClient.continueProcess(null, processState, callback);
            },
            // Request data Download. It shall send confirmation that will activate the task
            (callback) => {
                _downloadAdapter.downloadAll(processState.id, _downloadResponseQueue.getName(), processState.request_id, callback);
            },
            // Wait for messages to arrive and be processed
            (callback) => {
                setTimeout(callback, 100);
            },
            // Check for messages in the output queues
            (callback) => {
                _uploadResponseQueue.receive(null, 10000, (err, result) => {
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
});