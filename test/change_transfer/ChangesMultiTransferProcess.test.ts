let async = require('async');
let assert = require('chai').assert;

import { ProcessMockReferences } from "../mocks/ProcessMockReferences";
import { TestAdapterMemoryClient, ChangesSequenceTransferProcess, TestEntity, KnownDescriptors, ClientParam, GeneratorParam, ProcessParam, ChangesTransferParam } from "../../src";
import { IMessageQueue } from "pip-services3-messaging-node";
import { Parameters, Descriptor } from "pip-services3-commons-node";
import { ConsoleLogger, LogLevel } from "pip-services3-components-node";

suite('ChangesMultiTransferProcess', () => {
    var _references: ProcessMockReferences;
    var _pollAdapter: TestAdapterMemoryClient;
    var _postAdapter1: TestAdapterMemoryClient;
    var _postAdapter2: TestAdapterMemoryClient;
    var _queue1: IMessageQueue;
    var _queue2: IMessageQueue;
    var _process: ChangesSequenceTransferProcess<TestEntity, string>;

    setup((done) => {
        let logger = new ConsoleLogger();
        logger.setLevel(LogLevel.None);

        _references = new ProcessMockReferences([]);
        _references.put(new Descriptor('pip-services', 'logger', 'console', 'default', '1.0'), logger);
        
        _queue1 = _references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue("Framework.TestQueue1"));
        _queue2 = _references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue("Framework.TestQueue2"));

        _pollAdapter = new TestAdapterMemoryClient(null, _references, Parameters.fromTuples(
            ClientParam.InitialNumberOfEntities, 10,
            ClientParam.InitialCreateTime, new Date()
        ));

        _postAdapter1 = new TestAdapterMemoryClient(null, _references, Parameters.fromTuples(
            ClientParam.InitialNumberOfEntities, 0
        ));
        _postAdapter2 = new TestAdapterMemoryClient(null, _references, Parameters.fromTuples(
            ClientParam.InitialNumberOfEntities, 0
        ));

        _process = new ChangesSequenceTransferProcess<TestEntity, string>(
            "TestProcess", _references, Parameters.fromTuples(
                GeneratorParam.MessageType, "Framework.TestChange",
                GeneratorParam.Interval, 200,
                ProcessParam.NumberOfListeners, 1,
                ChangesTransferParam.SingleTransaction, false,
                ChangesTransferParam.BatchesPerRequest, 10,
                ChangesTransferParam.PollAdapter, _pollAdapter,
                ChangesTransferParam.TransferQueue1, _queue1,
                ChangesTransferParam.TransferQueue2, _queue2,
                ChangesTransferParam.PostAdapter1, _postAdapter1,
                ChangesTransferParam.PostAdapter2, _postAdapter2,
                ChangesTransferParam.Filter, "Key1=ABC;Key2=123",
                ChangesTransferParam.SyncDelay, 0
            ));

        done();
    });

    teardown((done) => {
        done();
    });

    test('It_Should_Not_Be_Broken_During_MultiChange', (done) => {
        assert.isEmpty(_postAdapter1.Entities);
        assert.isEmpty(_postAdapter2.Entities);

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
                assert.equal(_pollAdapter.Entities.length, _postAdapter1.Entities.length);
                assert.equal(_pollAdapter.Entities.length, _postAdapter2.Entities.length);
                callback();
            },
        ], done);
    });
});