let async = require('async');
let assert = require('chai').assert;

import { TestEntityGenerator } from "../../src/clients/TestEntityGenerator";
import { TestEntity } from "../../src/clients/TestEntity";
import { ChangePostProcess, EntityPostponeException, EntityRequestReviewException } from "../../src";
import { ProcessParam } from "../../src";
import { ChangesTransferParam } from "../../src";
import { IReadWriteClient } from "../../src";
import { KnownDescriptors } from "../../src";
import { IMessageQueue } from "pip-services3-messaging-node";
import { IProcessStatesClient, ProcessStateV1 } from "pip-clients-processstates-node";
import { ProcessMockReferences } from "../mocks/ProcessMockReferences";
import { Descriptor, Parameters } from "pip-services3-commons-node";
import { ConsoleLogger, LogLevel } from "pip-services3-components-node";
import { ProcessStatusV1, RecoveryManager } from "pip-services-processstates-node";

suite('ChangePostProcessFailure', () => {
    var _entityGenerator: TestEntityGenerator;
    var _changePostProcess: ChangePostProcess<TestEntity, string>;
    var _messageQueue: IMessageQueue;
    var _processStateClient: IProcessStatesClient;
    var _references: ProcessMockReferences;

    var _moqPostAdapter: IReadWriteClient<TestEntity, string>;

    var _postAdapterError: any;

    setup((done) => {
        let logger = new ConsoleLogger();
        logger.setLevel(LogLevel.None);

        _references = new ProcessMockReferences([]);
        _references.put(new Descriptor('pip-services', 'logger', 'console', 'default', '1.0'), logger);

        _entityGenerator = new TestEntityGenerator();
        _messageQueue = _references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue("Framework.TestQueue"));
        _processStateClient = _references.getOneRequired<IProcessStatesClient>(KnownDescriptors.ProcessStates);

        _moqPostAdapter = <IReadWriteClient<TestEntity, string>>
            {
                create(correlationId: string, entity: TestEntity, callback: (err: any, entity: TestEntity) => void): void {
                    callback(_postAdapterError, entity);
                },
                update(correlationId: string, entity: TestEntity, callback: (err: any, entity: TestEntity) => void): void {
                    callback(null, entity);
                }
            };

        _changePostProcess = new ChangePostProcess<TestEntity, string>(
            "TestProcess", _references, Parameters.fromTuples(
                ProcessParam.NumberOfListeners, 5, // use real settings
                ChangesTransferParam.TransferQueue, _messageQueue,
                ChangesTransferParam.PostAdapter, _moqPostAdapter,
                ChangesTransferParam.PostponeTimeout, 0,
                ProcessParam.RecoveryTimeout, 100,
                ProcessParam.MaxNumberOfAttempts, 1
            ));

        done();
    });

    teardown((done) => {
        _postAdapterError = null;
        _changePostProcess.close(null, done);
    });

    test('It_Should_Fail_And_Recovery_Message_When_Post_Adapter_Failed', (done) => {
        // Simulate any exception during HttpClient (Pip.RestClient) call
        _postAdapterError = new Error("Failed to create");

        var entity = _entityGenerator.create();
        _changePostProcess.beginListen();

        var processState: ProcessStateV1;

        async.series([
            (callback) => {
                _messageQueue.sendAsObject(null, "Test.Entity", entity, callback);
            },
            (callback) => {
                setTimeout(callback, 500);
            },
            (callback) => {
                _processStateClient.getProcesses(null, null, null, (err, page) => {
                    assert.isNull(err);
                    assert.equal(1, page.data.length);

                    processState = page.data[0];

                    // State is still starting and Recovery is required
                    assert.equal(processState.status, ProcessStatusV1.Starting);
                    assert.isTrue(RecoveryManager.isRecoveryDue(processState));

                    callback();
                });
            },
            (callback) => {
                // Re-send a recovery message
                var recoveryMessage = processState.recovery_message;
                assert.isNotNull(recoveryMessage);

                var recoveryEntity = JSON.parse(recoveryMessage.message) as TestEntity;
                assert.isNotNull(recoveryEntity);

                var correlation_id = recoveryMessage.correlation_id ?? processState.id;

                _messageQueue.sendAsObject(correlation_id, null, recoveryEntity, callback);
            },
            (callback) => {
                setTimeout(callback, 1000);
            },
            (callback) => {
                _processStateClient.getProcesses(null, null, null, (err, page) => {
                    assert.isNull(err);
                    assert.equal(1, page.data.length);

                    processState = page.data[0];

                    // Status is failed and Recovery is not required
                    assert.equal(processState.status, ProcessStatusV1.Failed);
                    assert.isFalse(RecoveryManager.isRecoveryDue(processState));

                    callback();
                });
            },
        ], done);
    });

    // test('It_Should_Not_Retry_When_Activate_Or_Start_Process_Failed', (done) => {
    //     done();
    // });

    test('It_Should_Request_Response_For_Process_When_Post_Adapter_Failed', (done) => {

        // Simulate specific EntityRequestReviewException from Adapter during HttpClient (Pip.RestClient) call
        _postAdapterError = new EntityRequestReviewException("1", "Something is wrong");

        var entity = _entityGenerator.create();
        _changePostProcess.beginListen();

        var processState: ProcessStateV1;

        async.series([
            (callback) => {
                _messageQueue.sendAsObject(null, "Test.Entity", entity, callback);
            },
            (callback) => {
                setTimeout(callback, 100);
            },
            (callback) => {
                _processStateClient.getProcesses(null, null, null, (err, page) => {
                    assert.isNull(err);
                    assert.equal(1, page.data.length);

                    processState = page.data[0];

                    // Status is Starting and Recovery is not required
                    assert.equal(processState.status, ProcessStatusV1.Suspended);
                    assert.isFalse(RecoveryManager.isRecoveryDue(processState));

                    callback();
                });
            },
        ], done);
    });

    test('It_Should_Fail_And_Recovery_Message_When_Post_Adapter_Failed_With_Entity_Postpone_Exception', (done) => {
        // Simulate specific EntityRequestReviewException from Adapter during HttpClient (Pip.RestClient) call
        _postAdapterError = new EntityPostponeException("1", "Something is wrong");

        var entity = _entityGenerator.create();
        _changePostProcess.beginListen();

        var processState: ProcessStateV1;

        async.series([
            (callback) => {
                _messageQueue.sendAsObject(null, "Test.Entity", entity, callback);
            },
            (callback) => {
                setTimeout(callback, 100);
            },
            (callback) => {
                _processStateClient.getProcesses(null, null, null, (err, page) => {
                    assert.isNull(err);
                    assert.equal(1, page.data.length);

                    processState = page.data[0];

                    // State is still starting and Recovery is required
                    assert.equal(processState.status, ProcessStatusV1.Starting);
                    //assert.isTrue(RecoveryManager.isRecoveryDue(processState));
                    assert.isNotNull(processState.recovery_time);

                    callback();
                });
            },
        ], done);
    });

    test('It_Should_Process_Duplicated_Messages_Using_Duplicate_Client', (done) => {

        _changePostProcess.setParameters(Parameters.fromTuples(
            ChangesTransferParam.RetriesGroup, "TestRetriesGroup"));

        var entity = _entityGenerator.create();

        _changePostProcess.beginListen();

        async.series([
            (callback) => {
                async.times(5, (n, next) => {
                    _messageQueue.sendAsObject(null, "Test.Entity", entity, (err) => {
                        next(err);
                    });
                }, callback);
            },
            (callback) => {
                setTimeout(callback, 1000);
            },
            (callback) => {
                _processStateClient.getProcesses(null, null, null, (err, page) => {
                    assert.isNull(err);
                    assert.equal(1, page.data.length);

                    var processState = page.data[0];

                    assert.equal(processState.status, ProcessStatusV1.Completed);

                    callback();
                });
            },
        ], done);
    });
});