"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let async = require('async');
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const pip_services3_commons_node_2 = require("pip-services3-commons-node");
const pip_services3_components_node_1 = require("pip-services3-components-node");
const pip_services3_components_node_2 = require("pip-services3-components-node");
const pip_clients_eventlog_node_1 = require("pip-clients-eventlog-node");
const pip_clients_eventlog_node_2 = require("pip-clients-eventlog-node");
const ProcessParam_1 = require("./ProcessParam");
const TaskProcessStage_1 = require("./TaskProcessStage");
// public class TaskHandler<T>: TaskHandler
// {
//     public TaskHandler(string processType, string taskType, IMessageQueue queue,
//         IReferences references, Parameters parameters)
//         : base(processType, taskType, typeof(T), queue, references, parameters)
//     { }
// }
class TaskHandler {
    constructor(processType, taskType, taskClass, queue, references, parameters) {
        this.maxNumberOfAttempts = 5;
        this._cancel = false;
        this._logger = new pip_services3_components_node_1.CompositeLogger();
        this._counters = new pip_services3_components_node_2.CompositeCounters();
        if (processType == null)
            throw new Error('Process type cannot be null');
        if (taskType == null)
            throw new Error('Task type cannot be null');
        if (taskClass == null)
            throw new Error('Task class cannot be null');
        if (queue == null)
            throw new Error('Queue cannot be null');
        if (references == null)
            throw new Error('References cannot be null');
        this.processType = processType;
        this.taskType = taskType;
        this.taskClass = taskClass;
        this.queue = queue;
        this.name = processType + '.' + taskType;
        this.setParameters(parameters);
        this.setReferences(references);
    }
    get references() { return this._references; }
    get logger() { return this._logger; }
    get counters() { return this._counters; }
    get eventLogClient() { return this._eventLogClient; }
    get settingsClient() { return this._settingsClient; }
    get retriesClient() { return this._retriesClient; }
    setReferences(references) {
        this._references = references;
        this._logger.setReferences(references);
        this.counters.setReferences(references);
        this._eventLogClient = references.getOneOptional(new pip_services3_commons_node_1.Descriptor('pip-services-eventlog', 'client', '*', '*', '1.0'));
        this._settingsClient = references.getOneOptional(new pip_services3_commons_node_1.Descriptor('pip-services-settings', 'client', '*', '*', '1.0'));
        this._retriesClient = references.getOneOptional(new pip_services3_commons_node_1.Descriptor('pip-services-retries', 'client', '*', '*', '1.0'));
    }
    setParameters(parameters) {
        this.parameters = (this.parameters || new pip_services3_commons_node_2.Parameters()).override(parameters);
        this.correlationId = this.parameters.getAsStringWithDefault(ProcessParam_1.ProcessParam.CorrelationId, this.correlationId);
        this.disabled = this.parameters.getAsBooleanWithDefault(ProcessParam_1.ProcessParam.Disabled, this.disabled);
        this.maxNumberOfAttempts = this.parameters.getAsIntegerWithDefault(ProcessParam_1.ProcessParam.MaxNumberOfAttempts, this.maxNumberOfAttempts);
        if (this.disabled && this.queue != null)
            this.queue.endListen(this.correlationId);
    }
    listen(callback) {
        async.whilst(() => !this._cancel, (callback) => {
            let disabled = this.disabled;
            async.series([
                (callback) => {
                    if (!disabled) {
                        this._logger.info(this.correlationId, 'Started task %s listening at %s', this.name, this.queue.getName());
                        // Start listening on the queue
                        this.queue.listen(this.correlationId, this);
                        this._logger.info(this.correlationId, 'Stopped task %s listening at %s', this.name, this.queue.getName());
                    }
                    callback();
                },
                (callback) => {
                    if (disabled) {
                        setTimeout(() => {
                            callback();
                        }, 30 * 1000);
                    }
                }
            ], (err) => {
                callback(err);
            });
        }, (err) => {
            if (callback)
                callback(err);
        });
    }
    beginListen() {
        this.listen((err) => {
            this._logger.error(null, err, 'Failed while listening for messages');
        });
    }
    createTask(message, queue, callback) {
        var task = this.taskClass();
        task.initialize(this.processType, this.taskType, message, queue, this.references, this.parameters, (err) => {
            callback(err, task);
        });
    }
    handlePoisonMessages(message, queue, errorMessage, callback) {
        // Remove junk
        //if (message.message_id == null || (message.message_type == null && message.message == null)) {
        //    queue.moveToDeadLetter(message, callback);
        //    return;
        //}
        if (this._retriesClient == null) {
            if (callback)
                callback(null);
            return;
        }
        // Record attempt
        let group = this.processType + '.attempt';
        this._retriesClient.addRetry(this.correlationId, group, message.message_id, null, (err, retry) => {
            if (err != null) {
                if (callback)
                    callback(err);
                return;
            }
            // Move to dead letter queue
            if (retry == null) {
                this.queue.moveToDeadLetter(message, callback);
            }
            else if (retry.attempt_count >= this.maxNumberOfAttempts) {
                queue.moveToDeadLetter(message, (err) => {
                    var _a, _b;
                    if (err != null) {
                        if (callback)
                            callback(err);
                        return;
                    }
                    if (this._eventLogClient != null) {
                        // Log warning
                        this._eventLogClient.logEvent((_a = message.correlation_id, (_a !== null && _a !== void 0 ? _a : this.correlationId)), {
                            source: this.processType,
                            type: pip_clients_eventlog_node_2.EventLogTypeV1.Failure,
                            correlation_id: (_b = message.correlation_id, (_b !== null && _b !== void 0 ? _b : this.correlationId)),
                            time: new Date(),
                            severity: pip_clients_eventlog_node_1.EventLogSeverityV1.Informational,
                            message: 'After ' + this.maxNumberOfAttempts + ' attempts moved poison message ' + message + ' to dead queue'
                        });
                    }
                    else {
                        if (callback)
                            callback(null);
                    }
                });
            }
        });
    }
    receiveMessage(message, queue, callback) {
        var leaseTimeout = this.parameters.getAsIntegerWithDefault('QueueLeaseTime', 2 * 60 * 1000);
        if (leaseTimeout < 30 * 1000) {
            leaseTimeout = 30 * 1000;
        }
        var task;
        var timing;
        async.series([
            (callback) => {
                queue.renewLock(message, leaseTimeout, callback);
            },
            (callback) => {
                this.createTask(message, queue, (err, result) => {
                    task = result;
                    callback(err);
                });
            },
            (callback) => {
                var _a;
                timing = this._counters.beginTiming(this.name + '.exec_time');
                this._counters.incrementOne(this.name + '.call_count');
                this._logger.debug((_a = message.correlation_id, (_a !== null && _a !== void 0 ? _a : this.correlationId)), 'Started task %s with %s', this.name, message);
                // Execute the task
                task.execute((err) => {
                    var _a;
                    if (!err) {
                        this._logger.debug((_a = message.correlation_id, (_a !== null && _a !== void 0 ? _a : this.correlationId)), 'Completed task %s', this.name);
                    }
                    callback(err);
                });
            }
        ], (ex) => {
            let processLockedException = ex;
            async.series([
                (callback) => {
                    var _a;
                    if (processLockedException) {
                        // Do nothing. Wait and retry
                        callback();
                        return;
                    }
                    // If message wasn't processed the record it as attempt
                    if (message.getReference() != null) {
                        // If process was started but not completed, use recovery
                        if (task.processStage == TaskProcessStage_1.TaskProcessStage.Processing && task.processState != null) {
                            // For exceeded number of attempts
                            if ((_a = task.processState.recovery_attempts, (_a !== null && _a !== void 0 ? _a : 0)) >= this.maxNumberOfAttempts)
                                task.failProcess(ex.message, (err) => {
                                    if (!err) {
                                        this.handlePoisonMessages(message, queue, ex.message, callback);
                                        return;
                                    }
                                    callback();
                                    return;
                                });
                            // For starting processs without key fail and retry
                            else
                                task.failAndRecoverProcess(ex.message, this.queue.getName(), message, null, (err) => {
                                    if (!err) {
                                        this.handlePoisonMessages(message, queue, ex.message, callback);
                                        return;
                                    }
                                    callback();
                                    return;
                                });
                        }
                        callback();
                    }
                    // Otherwise treat it as a poison message
                    else {
                        this.handlePoisonMessages(message, queue, ex.message, callback);
                    }
                }
            ], (err) => {
                var _a;
                this._counters.incrementOne(name + '.attempt_count');
                this._logger.error((_a = message.correlation_id, (_a !== null && _a !== void 0 ? _a : this.correlationId)), ex, 'Execution of task {0} failed', name);
                timing.endTiming();
                callback(err);
            });
        });
    }
    close(correlationId, callback) {
        this._cancel = true;
        this.queue.close(correlationId, (err) => {
            this._logger.debug(correlationId, 'Stopped task %s listening at %s', this.name, this.queue.getName());
            if (callback)
                callback(err);
        });
    }
}
exports.TaskHandler = TaskHandler;
//# sourceMappingURL=TaskHandler.js.map