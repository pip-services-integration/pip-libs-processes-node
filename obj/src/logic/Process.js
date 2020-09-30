"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Process = void 0;
let async = require('async');
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const ProcessParam_1 = require("./ProcessParam");
const pip_services3_components_node_1 = require("pip-services3-components-node");
const TaskHandler_1 = require("./TaskHandler");
class Process {
    constructor(processType, references = null, parameters = null) {
        this._handlers = [];
        if (processType == null)
            throw new Error('Process type cannot be null');
        this.processType = processType;
        this.setParameters(Process._defaultParameters.override(parameters));
        if (references != null)
            this.setReferences(references);
    }
    setReferences(references) {
        this._references = references;
        this._logger = new pip_services3_components_node_1.CompositeLogger(references);
        // _parameterizer = new ComponentParameterizer(ProcessType, this, references);
    }
    setParameters(parameters) {
        var _a;
        this.parameters = ((_a = this.parameters) !== null && _a !== void 0 ? _a : new pip_services3_commons_node_1.Parameters()).override(parameters);
        this.numberOfListeners = this.parameters.getAsIntegerWithDefault(ProcessParam_1.ProcessParam.NumberOfListeners, this.numberOfListeners);
        this.disabled = this.parameters.getAsBooleanWithDefault(ProcessParam_1.ProcessParam.Disabled, this.disabled);
        this.simulationInterval = this.parameters.getAsIntegerWithDefault(ProcessParam_1.ProcessParam.SimulationInterval, this.simulationInterval);
        if (this.simulationInterval == 0) {
            this.simulationInterval = Number.MAX_SAFE_INTEGER;
        }
        this.correlationId = this.parameters.getAsStringWithDefault(ProcessParam_1.ProcessParam.CorrelationId, this.correlationId);
        // Reconfigure handlers
        this._handlers.forEach((handler) => handler.setParameters(this.parameters));
    }
    close(correlationId, callback) {
        async.each(this._handlers, (handler, callback) => {
            handler.close(correlationId, callback);
        }, (err) => {
            if (callback)
                callback(err);
        });
    }
    addTask(taskType, taskClass, queue, numberOfListeners = 0, parameters = null) {
        if (taskType == null)
            throw new Error('Task type cannot be null');
        if (queue == null)
            throw new Error('Message queue cannot be null');
        parameters = this.parameters.override(parameters);
        numberOfListeners = numberOfListeners > 0 ? numberOfListeners : this.numberOfListeners;
        for (var index = 0; index < numberOfListeners; index++) {
            this.addTaskHandler(new TaskHandler_1.TaskHandler(this.processType, taskType, taskClass, queue, this._references, parameters));
        }
        return this;
    }
    beginListen() {
        if (this._handlers.length == 0)
            this._logger.warn(this.correlationId, 'Process %s has no tasks defined', this.processType);
        this._handlers.forEach((handler) => handler.beginListen());
    }
    addTaskHandler(taskHandler) {
        this._handlers.push(taskHandler);
        return this;
    }
}
exports.Process = Process;
Process._defaultParameters = pip_services3_commons_node_1.Parameters.fromTuples(ProcessParam_1.ProcessParam.NumberOfListeners, 5, ProcessParam_1.ProcessParam.RecoveryTimeout, 5 * 60 * 1000, // 5 min
ProcessParam_1.ProcessParam.ProcessTimeToLive, 7 * 24 * 60 * 1000, // 7 days
ProcessParam_1.ProcessParam.SimulationInterval, Number.MAX_SAFE_INTEGER // Timeout.InfiniteTimeSpan
);
//# sourceMappingURL=Process.js.map