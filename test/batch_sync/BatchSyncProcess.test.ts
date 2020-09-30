import { ProcessMockReferences } from '../mocks/ProcessMockReferences';
import { BatchSyncProcess, TestEntity, KnownDescriptors, ClientParam, TestAdapterMemoryClient, BatchSyncParam, ProcessParam } from '../../src';
import { IMessageQueue } from 'pip-services3-messaging-node';
import { IProcessStatesClient, ProcessStateV1 } from 'pip-clients-processstates-node';
import { Parameters, Descriptor } from 'pip-services3-commons-node';
import { ProcessStatusV1 } from 'pip-services-processstates-node';
import { ConsoleLogger, LogLevel } from 'pip-services3-components-node';

let async = require('async');
let assert = require('chai').assert;

suite('BatchSyncProcess', () => {
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
            ProcessParam.EntityType, 'TestEntity'
        ));

        done();
        //_references.open(null, done);
    });

    teardown((done) => {
        done();
    });

    test('It_Should_Not_Be_Broken_During_BatchSyncProcess_Normal_Flow', (done) => {
        var processState: ProcessStateV1;

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
                    }
                );
            },
            (callback) => {
                // Verify that both systems have identical data
                var data1 = _downloadAdapter.Entities;
                assert.isNotNull(data1);
                var data2 = _uploadAdapter.Entities;
                assert.isNotNull(data2);
                assert.equal(data1.length, data2.length);

                // Prevents Thread.AbortedException
                _process.close(null, callback);

                // Show performance counters
                //((CachedCounters)References.Counters).Dump();
            }], done);
    });
});