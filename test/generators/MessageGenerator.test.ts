import { IMessageQueue, MessageEnvelope } from "pip-services3-messaging-node";
import { Parameters } from "pip-services3-commons-node";
import { ProcessMockReferences } from "../mocks/ProcessMockReferences";
import { MockMessageGenerator } from "../mocks/MockMessageGenerator";
import { expect } from "chai";

let async = require('async');
let assert = require('chai').assert;

suite('MessageGenerator', () => {

    var _component: string = "Test";
    var _name: string = "Forward";
    var _references: ProcessMockReferences = new ProcessMockReferences([]);
    var _queue: IMessageQueue;
    var _parameters: Parameters = new Parameters();
    var _messageGenerator: MockMessageGenerator;
    var _sent: boolean = false;

    setup((done) => {
        _queue = <IMessageQueue>{
            getName(): string {
                return 'MockQueue';
            },
            send(correlationId: string, envelope: MessageEnvelope, callback?: (err: any) => void): void {
                _sent = true;
                callback(null);
            },
            close(correlationId: string, callback?: (err: any) => void): void {
                if (callback) callback(null);
            }
        };

        done();
    });

    teardown((done) => {
        if (_messageGenerator != null) _messageGenerator.close(null, done);
        else done();
    });

    test('It_Should_Throw_Exception_If_Component_Is_Null', (done) => {
        var badFn = function () {
            _messageGenerator = new MockMessageGenerator(null, _name, _queue, _references, _parameters);
        };
        expect(badFn).to.throw('Component cannot be null');
        done();
    });

    test('It_Should_Throw_Exception_If_Queue_Is_Null', (done) => {
        var badFn = function () {
            _messageGenerator = new MockMessageGenerator(_component, _name, null, _references, _parameters);
        };
        expect(badFn).to.throw('Queue cannot be null');
        done();
    });

    test('It_Should_Throw_Exception_If_References_Is_Null', (done) => {
        var badFn = function () {
            _messageGenerator = new MockMessageGenerator(_component, _name, _queue, null, _parameters);
        };
        expect(badFn).to.throw('References cannot be null');
        done();
    });

    test('It_Should_Create_New_Instance_Of_MessageGenerator', (done) => {
        _messageGenerator = new MockMessageGenerator(_component, _name, _queue, _references, _parameters);

        assert.isNotNull(_messageGenerator);
        done();
    });

    test('It_Should_Send_Messages', (done) => {
        _sent = false;

        async.series([
            (callback) => {
                _messageGenerator.sendMessage(new MessageEnvelope(null, null, null), (err) => {
                    assert.isNull(err);
                    assert.isTrue(_sent);
                    callback(err);
                });
            },
            (callback) => {
                _sent = false;
                _messageGenerator.sendMessageAsObject(null, "messageType", "message Content", (err) => {
                    assert.isNull(err);
                    assert.isTrue(_sent);
                    callback(err);
                });
            },
            (callback) => {
                _sent = false;
                _messageGenerator.sendMessageAsObject(null, "messageType", new Object(), (err) => {
                    assert.isNull(err);
                    assert.isTrue(_sent);
                    callback(err);
                });
            },
        ], done);
    });

    test('It_Should_Not_Begin_Execution_Twice', (done) => {
        _messageGenerator = new MockMessageGenerator(_component, _name, _queue, _references, _parameters);
        assert.equal(_messageGenerator.executionNumber, 0);

        _messageGenerator.beginExecute();
        async.series([
            (callback) => {
                setTimeout(callback, 100);
            },
            (callback) => {
                assert.equal(_messageGenerator.executionNumber, 1);
                _messageGenerator.beginExecute();
                callback();
            },
            (callback) => {
                setTimeout(() => {
                    assert.equal(_messageGenerator.executionNumber, 1);
                    callback();
                }, 100);
            }
        ], done);
    });
});