let async = require('async');
let assert = require('chai').assert;

import { ProcessMockReferences } from "../mocks/ProcessMockReferences";
import { TestEntityGenerator } from "../../src/clients/TestEntityGenerator";
import { IMessageQueue } from "pip-services3-messaging-node";
import { TestEntity } from "../../src/clients/TestEntity";
import { ChangePostProcess } from "../../src/change_transfer/ChangePostProcess";
import { IProcessStatesClient, ProcessStateV1, ProcessStatusV1, TaskStatusV1 } from "pip-clients-processstates-node";
import { KnownDescriptors, ClientParam, ProcessParam, ChangesTransferParam, TestPostponeAdapterMemoryClient } from "../../src";
import { Parameters } from "pip-services3-commons-node";

suite('ChangePostProcess', () => {
    var _references: ProcessMockReferences;
    var _generator: TestEntityGenerator;
    var _postAdapter: TestPostponeAdapterMemoryClient;
    var _queue: IMessageQueue;
    var _process: ChangePostProcess<TestEntity, string>;
    var _processStatesClient: IProcessStatesClient;

    setup((done) => {
        _references = new ProcessMockReferences([]);

        _generator = new TestEntityGenerator();

        _queue = _references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue("Framework.TestQueue"));

        _postAdapter = new TestPostponeAdapterMemoryClient([], _references, Parameters.fromTuples(
            ClientParam.InitialNumberOfEntities, 0
        ));

        _processStatesClient = _references.getOneRequired<IProcessStatesClient>(KnownDescriptors.ProcessStates);

        _process = new ChangePostProcess<TestEntity, string>(
            "TestProcess", _references, Parameters.fromTuples(
                ProcessParam.NumberOfListeners, 1,
                ChangesTransferParam.TransferQueue, _queue,
                ChangesTransferParam.PostAdapter, _postAdapter,
                ChangesTransferParam.PostponeTimeout, 0
            ));

        done();
    });

    teardown((done) => {
        _process.close(null, done);
    });

    test('It_Should_Change_Post_Normally', (done) => {
        assert.isEmpty(_postAdapter.Entities);

        var entity = _generator.create();
        async.series([
            (callback) => {
                _queue.sendAsObject(null, "Test.Entity", entity, (err) => {
                    assert.isNull(err);
                    callback()
                });
            },
            (callback) => {
                _process.beginListen();
                setTimeout(() => {
                    assert.equal(1, _postAdapter.Entities.length);
                    callback();
                }, 1000);
            },
        ], done);
    });

    test('It_Should_Change_Post_Postponed', (done) => {
        assert.isEmpty(_postAdapter.Entities);

        var process: ProcessStateV1;
        var entity = _generator.create();
        async.series([
            (callback) => {
                _queue.sendAsObject(null, "Test.Entity", entity, (err) => {
                    assert.isNull(err);
                    callback(err);
                });
            },
            (callback) => {
                _postAdapter.postpone = true;

                _process.beginListen();

                setTimeout(() => {
                    assert.isEmpty(_postAdapter.Entities);
                    callback();
                }, 1000);
            },
            (callback) => {
                _processStatesClient.getProcesses(null, null, null, (err, processs) => {
                    assert.equal(1, processs.data.length);

                    var process = processs.data[0];
                    assert.equal(ProcessStatusV1.Starting, process.status);
                    assert.equal(1, process.tasks.length);

                    var task = process.tasks[0];
                    assert.equal(TaskStatusV1.Failed, task.status);

                    assert.isNotNull(process.recovery_queue_name);
                    assert.isNotNull(process.recovery_message);
                    assert.isNotNull(process.recovery_time);
                    callback(err);
                });
            },
        ], done);
    });
});