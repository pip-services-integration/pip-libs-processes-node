"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let async = require('async');
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const GeneratorParam_1 = require("./GeneratorParam");
const pip_services3_components_node_1 = require("pip-services3-components-node");
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
        this.Component = component;
        this.Name = (name !== null && name !== void 0 ? name : typeof this);
        this.Queue = queue;
        this.setParameters(MessageGenerator._defaultParameters.override(parameters));
        if (references != null)
            this.setReferences(references);
    }
    setReferences(references) {
        this.References = references;
        this.Logger = new pip_services3_components_node_1.CompositeLogger(references);
        this.Counters = new pip_services3_components_node_1.CompositeCounters();
    }
    setParameters(parameters) {
        var _a;
        this.Parameters = (_a = this.Parameters, (_a !== null && _a !== void 0 ? _a : new pip_services3_commons_node_1.Parameters())).override(parameters);
        this.Interval = this.Parameters.getAsIntegerWithDefault(GeneratorParam_1.GeneratorParam.Interval, this.Interval);
        this.MessageType = this.Parameters.getAsStringWithDefault(GeneratorParam_1.GeneratorParam.MessageType, this.MessageType);
        this.Disabled = this.Parameters.getAsBooleanWithDefault(GeneratorParam_1.GeneratorParam.Disabled, this.Disabled);
        this.CorrelationId = this.Parameters.getAsStringWithDefault(GeneratorParam_1.GeneratorParam.CorrelationId, this.CorrelationId);
    }
    beginExecute(callback) {
        // If already started then exit
        if (this._started)
            return;
        async.whilst(() => !this._cancel, (callback) => {
            let disabled = this.Disabled;
            async.series([
                (callback) => {
                    if (!disabled) {
                        var timing = this.Counters.beginTiming(this.Component + '.' + this.Name + '.exec_time');
                        async.series([
                            (callback) => {
                                this.Counters.incrementOne(this.Component + '.' + this.Name + '.exec_count');
                                this.Logger.trace(this.CorrelationId, 'Started execution of ' + this.Name);
                                this.execute((err) => {
                                    if (!err) {
                                        this.Logger.trace(this.CorrelationId, 'Execution of ' + this.Name + ' completed');
                                    }
                                    callback(err);
                                });
                            }
                        ], (err) => {
                            if (!err) {
                                this.Counters.incrementOne(this.Component + '.' + this.Name + '.fail_count');
                                this.Logger.error(this.CorrelationId, err, 'Execution of ' + this.Name + ' failed');
                            }
                            timing.endTiming();
                            callback(err);
                        });
                    }
                },
                (callback) => {
                    if (disabled) {
                        this.delayExecute(callback);
                        return;
                    }
                    callback();
                }
            ], (err) => {
                callback(err);
            });
        }, (err) => {
            this._started = true;
            if (callback)
                callback(err);
        });
    }
    close(correlationId, callback) {
        // Cancel the processing
        this._cancel = true;
        // Close output queue
        this.Queue.close(correlationId, callback);
    }
    delayExecute(callback) {
        if (this.Interval == Number.MAX_SAFE_INTEGER) // Infinite
         {
            async.whilst(() => this.Interval == Number.MAX_SAFE_INTEGER || !this._cancel, (callback) => {
                setTimeout(() => {
                    callback();
                }, 5 * 60 * 1000); // 5 min
            }, (err) => {
                callback(err);
            });
        }
        else {
            let interval = this.Interval;
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