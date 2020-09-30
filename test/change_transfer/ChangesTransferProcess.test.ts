import { Parameters } from "pip-services3-commons-node";
import { IMessageQueue } from "pip-services3-messaging-node";
import { ChangesTransferParam, ChangesTransferProcess, ClientParam, GeneratorParam, KnownDescriptors, ProcessParam, TestEntity } from "../../src";
import { TestAdapterMemoryClient } from "../../src/clients/TestAdapterMemoryClient";
import { ProcessMockReferences } from "../mocks/ProcessMockReferences";

let async = require('async');
let assert = require('chai').assert;

suite('ChangesTransferProcess', () => {
    var _references: ProcessMockReferences;
    var _pollAdapter: TestAdapterMemoryClient;
    var _postAdapter: TestAdapterMemoryClient;
    var _queue: IMessageQueue;
    var _process: ChangesTransferProcess<TestEntity, string>;

    setup((done) => {
        _references = new ProcessMockReferences([]);

        _queue = _references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue("Framework.TestQueue"));

        _pollAdapter = new TestAdapterMemoryClient(null, _references, Parameters.fromTuples(
            ClientParam.InitialNumberOfEntities, 10,
            ClientParam.InitialCreateTime, new Date()
        ));

        _postAdapter = new TestAdapterMemoryClient(null, _references, Parameters.fromTuples(
            ClientParam.InitialNumberOfEntities, 0
        ));

        _process = new ChangesTransferProcess<TestEntity, string>(
            "TestProcess", _references, Parameters.fromTuples(
                GeneratorParam.MessageType, "Framework.TestChange",
                GeneratorParam.Interval, 200,
                ChangesTransferParam.SyncDelay, 0,
                ProcessParam.NumberOfListeners, 1,
                ChangesTransferParam.EntitiesPerRequest, 2,
                ChangesTransferParam.PollAdapter, _pollAdapter,
                ChangesTransferParam.TransferQueue, _queue,
                ChangesTransferParam.PostAdapter, _postAdapter
            ));

        done();
    });

    teardown((done) => {
        _process.close(null, done);
    });

    test('It_Should_Transfer_All_Entities', (done) => {
        assert.isEmpty(_postAdapter.Entities);

        _process.beginListen();

        setTimeout(() => {
            assert.equal(_pollAdapter.Entities.length, _postAdapter.Entities.length);
            done();
        }, 1000);
    });
});