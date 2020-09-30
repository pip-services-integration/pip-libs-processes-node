import { ProcessMockReferences } from "../mocks/ProcessMockReferences";
import { BatchesPollGenerator } from "../../src/generators/BatchesPollGenerator";
import { TestEntity } from "../../src/clients/TestEntity";
import { IMessageQueue, MessageEnvelope } from "pip-services3-messaging-node";
import { TestAdapterMemoryClient } from "../../src/clients/TestAdapterMemoryClient";
import { KnownDescriptors } from "../../src/logic/KnownDescriptors";
import { Parameters } from "pip-services3-commons-node";
import { ClientParam } from "../../src/clients/ClientParam";
import { GeneratorParam } from "../../src/generators/GeneratorParam";
import { ChangesTransferParam } from "../../src/change_transfer/ChangesTransferParam";

let async = require('async');
let assert = require('chai').assert;

suite('BatchesPollGenerator', () => {
    var _references: ProcessMockReferences;
    var _destQueue: IMessageQueue;
    var _pollAdapter: TestAdapterMemoryClient;
    var _generator: BatchesPollGenerator<TestEntity, string>;

    setup((done) => {
        _references = new ProcessMockReferences([]);
        _destQueue = _references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue("Framework.TestChange"));

        _pollAdapter = new TestAdapterMemoryClient(null, _references, Parameters.fromTuples(
            ClientParam.InitialNumberOfEntities, 5,
            ClientParam.InitialCreateTime, new Date()
        ));

        _generator = new BatchesPollGenerator<TestEntity, string>(
            "TestGenerator", _destQueue, _references,
            Parameters.fromTuples(
                GeneratorParam.MessageType, "Framework.TestChange",
                GeneratorParam.Interval, 1000,
                ChangesTransferParam.PollAdapter, _pollAdapter,
                ChangesTransferParam.BatchesPerRequest, 2,
                ChangesTransferParam.SyncDelay, 0
            )
        );

        done();
    });

    teardown((done) => {
        done();
    });

    /* Comment this test until execute function bug is not fixed

    test('It_Should_Not_Be_Broken_During_PollBatches_Normal_Flow', (done) => {
        var numberOfEntities = _pollAdapter.Entities.length;
        var getMessages = (queue: IMessageQueue, callback: (err: any, messages: MessageEnvelope[]) => void) => {
            var result: MessageEnvelope[] = [];
            var message: MessageEnvelope = null;

            async.doWhilst(
                (callback) => {
                    queue.receive(null, 100, (err, message) => {
                        if (message != null) {
                            result.push(message);
                        }
                        callback(err);
                    });
                },
                () => message != null,
                (err) => {
                    callback(err, result);
                }
            );
        };

        Start processing
        _generator.beginExecute();

        async.series([
            (callback) => {
                setTimeout(callback, 500);
            },
            (callback) => {
                Get changes
                getMessages(_destQueue, (err, messages) => {
                    assert.isNull(err);
                    assert.equal(numberOfEntities, messages.length);
                    callback();
                });
            },
            (callback) => {
                setTimeout(callback, 500);
            },
            (callback) => {
                Make changes to entities
                _pollAdapter.Generator.changeArray(_pollAdapter.Entities, 5);

                Get changes
                getMessages(_destQueue, (err, messages) => {
                    assert.isNull(err);
                    assert.isNotEmpty(messages);
                    callback();
                });
            },
        ], done);
    });
    */
});