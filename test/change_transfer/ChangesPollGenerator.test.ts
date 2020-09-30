import { Descriptor, Parameters } from "pip-services3-commons-node";
import { ConsoleLogger, LogLevel } from "pip-services3-components-node";
import { IMessageQueue, MessageEnvelope } from "pip-services3-messaging-node";
import { ChangesTransferParam } from "../../src/change_transfer/ChangesTransferParam";
import { ClientParam } from "../../src/clients/ClientParam";
import { TestAdapterMemoryClient } from "../../src/clients/TestAdapterMemoryClient";
import { TestEntity } from "../../src/clients/TestEntity";
import { ChangesPollGenerator } from "../../src/generators/ChangesPollGenerator";
import { GeneratorParam } from "../../src/generators/GeneratorParam";
import { KnownDescriptors } from "../../src/logic/KnownDescriptors";
import { ProcessMockReferences } from "../mocks/ProcessMockReferences";

let async = require('async');
let assert = require('chai').assert;

suite('ChangesPollGenerator', () => {
    var _references: ProcessMockReferences;
    var _destQueue: IMessageQueue;
    var _pollAdapter: TestAdapterMemoryClient;
    var _generator: ChangesPollGenerator<TestEntity, string>;

    setup((done) => {
        let logger = new ConsoleLogger();
        logger.setLevel(LogLevel.None);

        _references = new ProcessMockReferences([]);
        _references.put(new Descriptor('pip-services', 'logger', 'console', 'default', '1.0'), logger);

        _destQueue = _references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue("Framework.TestQueue"));

        _pollAdapter = new TestAdapterMemoryClient(null, _references, Parameters.fromTuples(
            ClientParam.InitialNumberOfEntities, 5,
            ClientParam.InitialCreateTime, new Date()
        ));

        _generator = new ChangesPollGenerator<TestEntity, string>(
            "TestGenerator", _destQueue, _references,
            Parameters.fromTuples(
                GeneratorParam.MessageType, "Framework.TestChange",
                GeneratorParam.Interval, 200,
                ChangesTransferParam.PollAdapter, _pollAdapter,
                ChangesTransferParam.EntitiesPerRequest, 2,
                ChangesTransferParam.SyncDelay, 0
            )
        );

        done();
    });

    teardown((done) => {
        _generator.close(null, done);
    });

    test('It_Should_PollChanges_Normally', (done) => {
        let numberOfEntities = _pollAdapter.Entities.length;
        let getMessages = (queue: IMessageQueue, callback: (err: any, messages: MessageEnvelope[]) => void) => {
            let result: MessageEnvelope[] = [];
            let message: MessageEnvelope = null;

            async.doWhilst(
                (callback) => {
                    queue.receive(null, 1000, (err, envelope) => {
                        message = envelope;
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

        // Start processing
        _generator.beginExecute();

        var changesCount = 0;

        async.series([
            (callback) => {
                setTimeout(callback, 50);
            },
            (callback) => {
                // Get changes
                getMessages(_destQueue, (err, messages) => {
                    assert.isNull(err);
                    assert.equal(numberOfEntities, messages.length);

                    // Make changes to entities
                    _pollAdapter.Generator.changeArray(_pollAdapter.Entities, 5);

                    changesCount = _pollAdapter.Entities.filter(x => x.change_time > _generator.lastSyncTimeUtc).length;

                    callback();
                });
            },
            (callback) => {
                setTimeout(callback, 50);
            },
            (callback) => {
                // Get changes
                getMessages(_destQueue, (err, messages) => {
                    assert.isNull(err);
                    assert.equal(changesCount, messages.length);
                    callback();
                });
            }
        ], done);
    });
});