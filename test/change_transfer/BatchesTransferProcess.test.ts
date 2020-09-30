import { BatchesTransferProcess, TestEntity, TestAdapterMemoryClient, KnownDescriptors, ClientParam, GeneratorParam, ChangesTransferParam, ProcessParam } from "../../src";
import { IMessageQueue, MessageEnvelope } from "pip-services3-messaging-node";
import { ProcessMockReferences } from "../mocks/ProcessMockReferences";
import { Parameters, Descriptor } from "pip-services3-commons-node";
import { LogLevel, ConsoleLogger } from "pip-services3-components-node";

let async = require('async');
let assert = require('chai').assert;

suite('BatchesTransferProcess', () => {
    var _references: ProcessMockReferences;
    var _pollAdapter: TestAdapterMemoryClient;
    var _postAdapter: TestAdapterMemoryClient;
    var _queue: IMessageQueue;
    var _process: BatchesTransferProcess<TestEntity, string>;

    setup((done) => {
        let logger = new ConsoleLogger();
        logger.setLevel(LogLevel.None);

        _references = new ProcessMockReferences([]);
        _references.put(new Descriptor('pip-services', 'logger', 'console', 'default', '1.0'), logger);

        _queue = _references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue("Framework.TestQueue"));

        _pollAdapter = new TestAdapterMemoryClient(null, _references, Parameters.fromTuples(
            ClientParam.InitialNumberOfEntities, 10,
            ClientParam.InitialCreateTime, new Date()
        ));

        _postAdapter = new TestAdapterMemoryClient(null, _references, Parameters.fromTuples(
            ClientParam.InitialNumberOfEntities, 0
        ));

        _process = new BatchesTransferProcess<TestEntity, string>(
            "TestProcess", _references, Parameters.fromTuples(
                GeneratorParam.MessageType, "Framework.TestChange",
                GeneratorParam.Interval, 200,
                ChangesTransferParam.SyncDelay, 0,
                ChangesTransferParam.RetriesGroup, "TestRetriesGroup",
                ProcessParam.NumberOfListeners, 1,
                ChangesTransferParam.BatchesPerRequest, 10,
                ChangesTransferParam.PollAdapter, _pollAdapter,
                ChangesTransferParam.TransferQueue, _queue,
                ChangesTransferParam.PostAdapter, _postAdapter
            ));

        done();
    });

    teardown((done) => {
        _process.close(null, done);
    });

    test('It_should_not_Be_broken_During_BatchesTransfer', (done) => {
        assert.isEmpty(_postAdapter.Entities);

        _process.beginListen();

        async.series([
            (callback) => {
                setTimeout(() => {
                    callback();
                }, 500);
            },
            (callback) => {
                _process.close(null, (err) => {
                    callback();
                });
            },
            (callback) => {
                assert.equal(_pollAdapter.Entities.length, _postAdapter.Entities.length);
                callback();
            },
        ], done);
    });
});