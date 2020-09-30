import { ProcessMockReferences } from "../mocks/ProcessMockReferences";
import { IMessageQueue } from "pip-services3-messaging-node";
import { BatchSyncProcess } from "../../src/batch_sync/BatchSyncProcess";
import { TestEntity } from "../../src/clients/TestEntity";
import { TestAdapterMemoryClient } from "../../src/clients/TestAdapterMemoryClient";
import { IProcessStatesClient, ProcessStatusV1, ProcessStateV1 } from "pip-clients-processstates-node";
import { ConsoleLogger, LogLevel } from "pip-services3-components-node";
import { Descriptor, Parameters } from "pip-services3-commons-node";
import { KnownDescriptors } from "../../src/logic/KnownDescriptors";
import { ClientParam } from "../../src/clients/ClientParam";
import { BatchSyncParam } from "../../src/batch_sync/BatchSyncParam";
import { ProcessParam } from "../../src/logic/ProcessParam";

let async = require('async');
let assert = require('chai').assert;

suite('BatchSyncIncrementalProcess', () => {
    var _references: ProcessMockReferences;
    var _process: BatchSyncProcess<TestEntity>;

    var _startQueue: IMessageQueue;
    var _downloadResponseQueue: IMessageQueue;
    var _uploadResponseQueue: IMessageQueue;
    var _recoveryQueue: IMessageQueue;

    var _downloadAdapter: TestAdapterMemoryClient;
    var _uploadAdapter: TestAdapterMemoryClient;

    var _processStatesClient: IProcessStatesClient;

    setup((done) => {
        let logger = new ConsoleLogger();
        logger.setLevel(LogLevel.None);

        _references = new ProcessMockReferences([]);
        _references.put(new Descriptor('pip-services', 'logger', 'console', 'default', '1.0'), logger);

        // Message queues
        _startQueue = _references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue('StartQueue'));
        _downloadResponseQueue = _references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue('DownloadResponseQueue'));
        _uploadResponseQueue = _references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue('UploadResponseQueue'));
        _recoveryQueue = _references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue('RecoveryQueue'));

        // Adapter where entities will be Downloaded from
        _downloadAdapter = new TestAdapterMemoryClient(null, _references, Parameters.fromTuples(
            ClientParam.InitialNumberOfEntities, 1000
        ));

        // Adapter where entities will be Upload to
        _uploadAdapter = new TestAdapterMemoryClient([], _references, null);

        _processStatesClient = _references.getOneRequired<IProcessStatesClient>(KnownDescriptors.ProcessStates);

        _process = new BatchSyncProcess<TestEntity>('Sample.BatchSync', _references, Parameters.fromTuples(
            BatchSyncParam.StartQueue, _startQueue,
            BatchSyncParam.DownloadResponseQueue, _downloadResponseQueue,
            BatchSyncParam.UploadResponseQueue, _uploadResponseQueue,
            BatchSyncParam.RecoveryQueue, _recoveryQueue,

            BatchSyncParam.DownloadAdapter, _downloadAdapter,
            BatchSyncParam.UploadAdapter, _uploadAdapter,

            ProcessParam.ProcessTimeToLive, 60 * 60 * 1000, // 1hour
            ProcessParam.NumberOfListeners, 1,
            ProcessParam.RecoveryTimeout, 60 * 1000, // 1min
            ProcessParam.EntityType, 'TestEntity',
            BatchSyncParam.IncrementalChanges, true
        ));

        done();
    });

    teardown((done) => {
        if (_process) _process.close(null, done);
        else done();
    });

    test('It_Should_Not_Be_Broken_During_BatchSyncProcess_Incremental_Flow', (done) => {
        var processState: ProcessStateV1;

        _uploadAdapter.Entities = [];
        _uploadAdapter.Entities.push(..._downloadAdapter.Entities);
        _downloadAdapter.Generator.changeArray(_downloadAdapter.Entities, 50);

        // console.log('download entities count: %s', _downloadAdapter.Entities.length);
        // console.log('upload entities count: %s', _uploadAdapter.Entities.length);

        async.series([
            (callback) => {
                // Start listening
                _process.beginListen();

                // Send a message into the input queue
                _startQueue.sendAsObject(null, 'Start', null, (err) => {
                    callback(err);
                });
            },
            (callback) => {
                // Wait for messages to arrive and be processed
                setTimeout(callback, 500)
            },
            (callback) => {
                _processStatesClient.getProcesses(null, null, null, (err, page) => {
                    assert.isNotNull(page);
                    assert.equal(1, page.data.length);

                    processState = page.data[0];
                    callback(err);
                });
            },
            (callback) => {
                // Wait for messages to arrive and be processed
                var loops = 0;
                async.whilst(
                    () => loops < 100 && processState.status != ProcessStatusV1.Completed,
                    (callback) => {
                        setTimeout(callback, 100);
                        loops++;
                    },
                    (err) => {
                        callback(err);

                        // Check for completed processes
                        assert.equal(ProcessStatusV1.Completed, processState.status);
                        assert.isNotNull(processState.tasks);
                        assert.equal(3, processState.tasks.length);
                        assert.isNotEmpty(_uploadAdapter.Entities);
                    }
                );
            },
            (callback) => {
                // Verify that both systems have identical data
                var data1 = _downloadAdapter.Entities;
                assert.isNotNull(data1);
                var data2 = _uploadAdapter.Entities;
                assert.isNotNull(data2);

                var downloadEntitiesCount = data1.length;
                var uploadEntitiesCount = data2.length;

                // console.log('download entities count: %s', downloadEntitiesCount);
                // console.log('upload entities count: %s', uploadEntitiesCount);

                assert.equal(downloadEntitiesCount, uploadEntitiesCount);

                // Prevents Thread.AbortedException
                _process.close(null, callback);

                // Show performance counters
                //((CachedCounters)References.Counters).Dump();
            }], done);
    });
});