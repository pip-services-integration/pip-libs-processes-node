"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageGenerator = void 0;
let async = require('async');
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const GeneratorParam_1 = require("./GeneratorParam");
const pip_services3_messaging_node_1 = require("pip-services3-messaging-node");
const pip_services3_components_node_1 = require("pip-services3-components-node");
const timers_1 = require("timers");
class MessageGenerator {
    constructor(component, name, queue, references, parameters = null) {
        this._started = false;
        this._cancel = false;
        if (component == null)
            throw new Error('Component cannot be null');
        if (queue == null)
            throw new Error('Queue cannot be null');
        if (references == null)
            throw new Error('References cannot be null');
        this.component = component;
        this.name = name !== null && name !== void 0 ? name : typeof this;
        this.queue = queue;
        this.setParameters(MessageGenerator._defaultParameters.override(parameters));
        if (references != null)
            this.setReferences(references);
    }
    setReferences(references) {
        this.references = references;
        this.logger = new pip_services3_components_node_1.CompositeLogger(references);
        this.counters = new pip_services3_components_node_1.CompositeCounters();
    }
    setParameters(parameters) {
        var _a;
        this.parameters = ((_a = this.parameters) !== null && _a !== void 0 ? _a : new pip_services3_commons_node_1.Parameters()).override(parameters);
        this.interval = this.parameters.getAsIntegerWithDefault(GeneratorParam_1.GeneratorParam.Interval, this.interval);
        this.messageType = this.parameters.getAsStringWithDefault(GeneratorParam_1.GeneratorParam.MessageType, this.messageType);
        this.disabled = this.parameters.getAsBooleanWithDefault(GeneratorParam_1.GeneratorParam.Disabled, this.disabled);
        this.correlationId = this.parameters.getAsStringWithDefault(GeneratorParam_1.GeneratorParam.CorrelationId, this.correlationId);
    }
    sendMessageAsObject(correlationId, messageType, message, callback) {
        var envelope = new pip_services3_messaging_node_1.MessageEnvelope(correlationId !== null && correlationId !== void 0 ? correlationId : this.correlationId, messageType, message);
        this.sendMessage(envelope, callback);
    }
    sendMessage(envelop, callback) {
        var _a;
        // Redefine message type based on the configuration
        envelop.message_type = (_a = envelop.message_type) !== null && _a !== void 0 ? _a : this.messageType;
        this.queue.send(this.correlationId, envelop, (err) => {
            if (err) {
                if (callback)
                    callback(err);
                return;
            }
            this.logger.trace(this.correlationId, "%s.%s sent message to %s", this.component, this.name, this.queue);
            if (callback)
                callback(null);
        });
    }
    beginExecute(callback) {
        // If already started then exit
        if (this._started)
            return;
        this._started = true;
        async.whilst(() => !this._cancel, (callback) => {
            let disabled = this.disabled;
            async.series([
                (callback) => {
                    if (disabled) {
                        callback();
                        return;
                    }
                    var timing = this.counters.beginTiming(this.component + '.' + this.name + '.exec_time');
                    async.series([
                        (callback) => {
                            this.counters.incrementOne(this.component + '.' + this.name + '.exec_count');
                            this.logger.trace(this.correlationId, 'Started execution of ' + this.name);
                            this.execute((err) => {
                                if (!err) {
                                    this.logger.trace(this.correlationId, 'Execution of ' + this.name + ' completed');
                                }
                                callback(err);
                            });
                        }
                    ], (err) => {
                        if (err) {
                            this.counters.incrementOne(this.component + '.' + this.name + '.fail_count');
                            this.logger.error(this.correlationId, err, 'Execution of ' + this.name + ' failed');
                        }
                        timing.endTiming();
                        callback(err);
                    });
                },
                (callback) => {
                    if (disabled) {
                        this.delayExecute(callback);
                        return;
                    }
                    callback();
                }
            ], (err) => {
                if (!err)
                    timers_1.setImmediate(callback);
                else
                    callback(err);
                // callback(err);
            });
        }, (err) => {
            this._started = false;
            if (callback)
                callback(err);
        });
    }
    close(correlationId, callback) {
        // Cancel the processing
        this._cancel = true;
        // Close output queue
        this.queue.close(correlationId, callback);
    }
    delayExecute(callback) {
        if (this.interval == Number.MAX_SAFE_INTEGER) // Infinite
         {
            async.whilst(() => this.interval == Number.MAX_SAFE_INTEGER || !this._cancel, (callback) => {
                setTimeout(() => {
                    callback();
                }, 5 * 60 * 1000); // 5 min
            }, (err) => {
                callback(err);
            });
        }
        else {
            let interval = this.interval;
            let timeout = 10 * 1000; // 10 sec
            async.whilst(() => interval > 0 || !this._cancel, (callback) => {
                setTimeout(() => {
                    interval -= timeout;
                    callback();
                }, timeout);
            }, (err) => {
                callback(err);
            });
        }
    }
}
exports.MessageGenerator = MessageGenerator;
MessageGenerator._defaultParameters = pip_services3_commons_node_1.Parameters.fromTuples(GeneratorParam_1.GeneratorParam.Interval, 5 * 60 * 1000);
//# sourceMappingURL=MessageGenerator.js.map