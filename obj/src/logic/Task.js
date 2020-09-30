"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Task = void 0;
let async = require('async');
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const pip_services3_messaging_node_1 = require("pip-services3-messaging-node");
const pip_services3_components_node_1 = require("pip-services3-components-node");
const KnownDescriptors_1 = require("./KnownDescriptors");
const pip_clients_processstates_node_1 = require("pip-clients-processstates-node");
const TaskProcessStage_1 = require("./TaskProcessStage");
const ProcessParam_1 = require("./ProcessParam");
class Task {
    constructor() {
    }
    initialize(processType, taskType, message, queue, references, parameters, callback) {
        if (processType == null) {
            callback(new Error('Process type cannot be null'));
            return;
        }
        if (taskType == null) {
            callback(new Error('Task type cannot be null'));
            return;
        }
        if (references == null) {
            callback(new Error('References cannot be null'));
            return;
        }
        this.name = processType + '.' + taskType;
        this.processType = processType;
        this.taskType = taskType;
        this.message = message;
        this.queue = queue;
        this.processId = message != null ? message.correlation_id : null;
        this.processStage = TaskProcessStage_1.TaskProcessStage.Started;
        this.setReferences(references);
        this.setParameters(parameters);
        this.statusSection = processType + '.Status';
        let settingsSection = this.getSettingsSection();
        let correlationId = this.getCorrelationId();
        this._settingsClient.setSection(correlationId, settingsSection, pip_services3_commons_node_1.ConfigParams.fromTuples('LastActivationTimeUtc', new Date()), (err, parameters) => {
            callback(err);
        });
    }
    setReferences(references) {
        this._references = references;
        this._logger = new pip_services3_components_node_1.CompositeLogger(references);
        this._counters = new pip_services3_components_node_1.CompositeCounters();
        this._settingsClient = this._references.getOneRequired(KnownDescriptors_1.KnownDescriptors.Settings);
        this._eventLogClient = this._references.getOneRequired(KnownDescriptors_1.KnownDescriptors.EventLog);
        this._processStatesClient = this._references.getOneRequired(KnownDescriptors_1.KnownDescriptors.ProcessStates);
        this._mappingsClient = this._references.getOneRequired(KnownDescriptors_1.KnownDescriptors.Mappings);
        this._tempBlobClient = this._references.getOneRequired(KnownDescriptors_1.KnownDescriptors.TempBlobs);
        this._retriesClient = this._references.getOneRequired(KnownDescriptors_1.KnownDescriptors.Retries);
    }
    setParameters(parameters) {
        this._parameters = (parameters !== null && parameters !== void 0 ? parameters : new pip_services3_commons_node_1.Parameters()).override(parameters);
        this.correlationId = this._parameters.getAsStringWithDefault('correlation_id', this.correlationId);
    }
    getCorrelationId() {
        var _a;
        return (_a = this.processId) !== null && _a !== void 0 ? _a : this.correlationId;
    }
    getSettingsSection(section) {
        return (section !== null && section !== void 0 ? section : this.statusSection) + '.' + this.processId;
    }
    toMessageEnvelope(message) {
        var _a;
        if (message == null)
            return null;
        if (message.constructor.name === 'MessageEnvelope')
            return message;
        return new pip_services3_messaging_node_1.MessageEnvelope((_a = this.processId) !== null && _a !== void 0 ? _a : this.correlationId, null, message);
    }
    sendMessage(queueName, message, callback) {
        var queue = this._references.getOneRequired(KnownDescriptors_1.KnownDescriptors.messageQueue(queueName));
        var envelop = this.toMessageEnvelope(message);
        let correlationId = this.getCorrelationId();
        queue.send(correlationId, envelop, (err) => {
            if (err) {
                this._logger.error(correlationId, err, 'Failed to sent message %s to %s', envelop, queue);
                callback(err);
                return;
            }
            this._logger.debug(correlationId, 'Sent message %s to %s', envelop, queue);
            callback(null);
        });
    }
    completeMessage(callback) {
        this.queue.complete(this.message, callback);
    }
    abandonMessage(callback) {
        this.queue.abandon(this.message, callback);
    }
    moveMessageToDead(callback) {
        this.queue.moveToDeadLetter(this.message, callback);
    }
    logMessage(level, message) {
        this._logger.log(level, this.processId, null, message);
    }
    logError(ex, message) {
        this._logger.error(this.processId, ex, message);
    }
    validateMessage(message, schema) {
        if (message == null)
            throw new Error('Message cannot be null');
        // Validate and throw validation exception
        if (schema != null)
            schema.validateAndThrowException(null, message);
    }
    checkCurrentProcess() {
        if (this.processState == null || this.taskState == null)
            throw new Error('Process is not started or activated');
    }
    checkProcessStage(stage) {
        if (stage == TaskProcessStage_1.TaskProcessStage.Processing && (this.processStage >= stage))
            throw new pip_clients_processstates_node_1.ProcessInvalidStateExceptionV1('Process can be started of activated only once');
        if (stage == TaskProcessStage_1.TaskProcessStage.Processed && (this.processStage >= stage))
            throw new pip_clients_processstates_node_1.ProcessInvalidStateExceptionV1('Process activity can be closed only once');
    }
    getCurrentTask() {
        let tasks = this.processState.tasks.filter(a => a.status == pip_clients_processstates_node_1.TaskStatusV1.Executing && a.type == this.taskType);
        return tasks.length == 1 ? tasks[0] : null;
    }
    toMessage(envelope) {
        var _a;
        let message = {
            correlation_id: envelope.correlation_id,
            message: (_a = envelope.message) === null || _a === void 0 ? void 0 : _a.toString(),
            message_id: envelope.message_id,
            message_type: envelope.message_type,
            sent_time: envelope.sent_time
        };
        return message;
    }
    startProcess(processKey = null, callback) {
        this.checkProcessStage(TaskProcessStage_1.TaskProcessStage.Processing);
        let correlationId = this.getCorrelationId();
        let timeToLive = this._parameters.getAsNullableInteger(ProcessParam_1.ProcessParam.ProcessTimeToLive);
        let message = this.toMessage(this.message);
        let settingsSection = this.getSettingsSection();
        async.series([
            (callback) => {
                // Start process
                this._processStatesClient.startProcess(correlationId, this.processType, processKey, this.taskType, this.queue.getName(), message, timeToLive, (err, state) => {
                    if (err) {
                        callback(err);
                        return;
                    }
                    this.processState = state;
                    callback();
                });
            },
            (callback) => {
                // Set process info
                this.processKey = processKey;
                this.processId = this.processState.id;
                // Set current task info
                this.taskState = this.getCurrentTask();
                this.taskState.queue_name = this.queue.getName();
                this.taskState.message = message;
                this.processStage = TaskProcessStage_1.TaskProcessStage.Processing;
                // Write debug message
                if (processKey != null)
                    this._logger.debug(this.processId, 'Started process %s with key %s', this.name, processKey);
                else
                    this._logger.debug(this.processId, 'Started process %s', this.name);
                callback();
            },
            (callback) => {
                // Write status
                if (this.statusSection != null) {
                    callback();
                    return;
                }
                this._settingsClient.setSection(correlationId, settingsSection, pip_services3_commons_node_1.ConfigParams.fromTuples('LastStartedTimeUtc', new Date(Date.now())), (err, parameters) => {
                    callback(err);
                });
            },
            (callback) => {
                // Write status
                if (this.statusSection != null) {
                    callback();
                    return;
                }
                this._settingsClient.modifySection(correlationId, settingsSection, null, pip_services3_commons_node_1.ConfigParams.fromTuples('StartedProcesss', 1), (err, parameters) => {
                    callback(err);
                });
            }
        ], (err) => {
            if (err) {
                this._logger.error(correlationId, err, 'Failed to start process %s', this.name);
            }
            callback(err, this.processState);
        });
    }
    activateOrStartProcessWithKey(processKey, callback) {
        this.checkProcessStage(TaskProcessStage_1.TaskProcessStage.Processing);
        if (processKey == null) {
            callback(new Error('Process key cannot be null'), null);
            return;
        }
        let correlationId = this.getCorrelationId();
        let timeToLive = this._parameters.getAsNullableInteger(ProcessParam_1.ProcessParam.ProcessTimeToLive);
        let message = this.toMessage(this.message);
        let settingsSection = this.getSettingsSection();
        async.series([
            (callback) => {
                // Call the service and start process
                this._processStatesClient.activateOrStartProcess(correlationId, this.processType, processKey, this.taskType, this.queue.getName(), message, timeToLive, (err, state) => {
                    if (err) {
                        callback(err);
                        return;
                    }
                    this.processState = state;
                    callback();
                });
            },
            (callback) => {
                // Set process info
                this.processKey = processKey;
                this.processId = this.processState.id;
                // Set current task info
                this.taskState = this.getCurrentTask();
                this.taskState.queue_name = this.queue.getName();
                this.taskState.message = message;
                this.processStage = TaskProcessStage_1.TaskProcessStage.Processing;
                // Write debug message
                if (processKey != null)
                    this._logger.debug(this.processId, 'Started or activated process %s with key %s', this.name, processKey);
                else
                    this._logger.debug(this.processId, 'Started or activited process %s', this.name);
                callback();
            },
            (callback) => {
                // Write status
                if (this.statusSection != null) {
                    callback();
                    return;
                }
                this._settingsClient.setSection(correlationId, settingsSection, pip_services3_commons_node_1.ConfigParams.fromTuples('LastStartedTimeUtc', new Date(Date.now())), (err, parameters) => {
                    callback(err);
                });
            },
            (callback) => {
                // Write status
                if (this.statusSection != null) {
                    callback();
                    return;
                }
                this._settingsClient.modifySection(correlationId, settingsSection, null, pip_services3_commons_node_1.ConfigParams.fromTuples('StartedProcesss', 1), (err, parameters) => {
                    callback(err);
                });
            }
        ], (err) => {
            if (err) {
                if (processKey != null)
                    this._logger.error(correlationId, err, 'Failed to start or reactivate process %s with key %s', this.name, processKey);
                else
                    this._logger.error(correlationId, err, 'Failed to start or reactivate process %s', this.name);
            }
            callback(err, this.processState);
        });
    }
    activateProcess(processId = null, callback) {
        this.checkProcessStage(TaskProcessStage_1.TaskProcessStage.Processing);
        let correlationId = this.getCorrelationId();
        let message = this.toMessage(this.message);
        async.series([
            (callback) => {
                // Call the service and start process
                this._processStatesClient.activateProcess(correlationId, processId !== null && processId !== void 0 ? processId : this.processId, this.taskType, this.queue.getName(), message, (err, state) => {
                    if (err) {
                        callback(err);
                        return;
                    }
                    this.processState = state;
                    callback();
                });
            },
            (callback) => {
                // Set process info
                this.processId = this.processState.id;
                // Set current task info
                this.taskState = this.getCurrentTask();
                this.taskState.queue_name = this.queue.getName();
                this.taskState.message = message;
                this.processStage = TaskProcessStage_1.TaskProcessStage.Processing;
                this._logger.debug(processId, 'Activited process %s', this.name);
                callback();
            }
        ], (err) => {
            if (err) {
                this._logger.error(correlationId, err, 'Failed to activate process %s', this.name);
            }
            callback(err, this.processState);
        });
    }
    activateProcessWithKey(processKey, callback) {
        if (processKey == null) {
            callback(new Error('Process key cannot be null'), null);
            return;
        }
        this.checkProcessStage(TaskProcessStage_1.TaskProcessStage.Processing);
        let correlationId = this.getCorrelationId();
        let message = this.toMessage(this.message);
        async.series([
            (callback) => {
                // Call the service and activate process
                this._processStatesClient.activateProcessByKey(correlationId, this.processType, processKey, this.taskType, this.queue.getName(), message, (err, state) => {
                    if (err) {
                        callback(err);
                        return;
                    }
                    this.processState = state;
                    callback();
                });
            },
            (callback) => {
                // Set process info
                this.processId = this.processState.id;
                // Set current task info
                this.taskState = this.getCurrentTask();
                this.taskState.queue_name = this.queue.getName();
                this.taskState.message = message;
                this.processStage = TaskProcessStage_1.TaskProcessStage.Processing;
                this._logger.debug(correlationId, 'Activited process %s with key %s', this.name, processKey);
                callback();
            }
        ], (err) => {
            if (err) {
                this._logger.error(correlationId, err, 'Failed to activate process %s with key %s', this.name, processKey);
            }
            callback(err, this.processState);
        });
    }
    rollbackProcess(errorMessage, callback) {
        let correlationId = this.getCorrelationId();
        async.series([
            (callback) => {
                if (this.processState != null && this.taskState != null) {
                    this.taskState.error_message = errorMessage;
                    this._processStatesClient.rollbackProcess(correlationId, this.processState, (err) => {
                        callback(err);
                    });
                }
            },
            (callback) => {
                this.processStage = TaskProcessStage_1.TaskProcessStage.Processed;
                this.queue.abandon(this.message, (err) => {
                    this._logger.debug(correlationId, 'Rollbacked process %s: %s', this.name, errorMessage);
                    callback(err);
                });
            }
        ], (err) => {
            if (err) {
                this._logger.error(correlationId, err, 'Failed to rollback process %s', this.name);
            }
            callback(err);
        });
    }
    continueProcess(callback) {
        this.checkCurrentProcess();
        this.checkProcessStage(TaskProcessStage_1.TaskProcessStage.Processed);
        let correlationId = this.getCorrelationId();
        async.series([
            (callback) => {
                this._processStatesClient.continueProcess(correlationId, this.processState, (err) => {
                    callback(err);
                });
            },
            (callback) => {
                this.processStage = TaskProcessStage_1.TaskProcessStage.Processed;
                this.queue.complete(this.message, (err) => {
                    this._logger.debug(correlationId, 'Continued process %s', this.name);
                    callback(err);
                });
            }
        ], (err) => {
            if (err) {
                this._logger.error(correlationId, err, 'Failed to continue process %s', this.name);
            }
            callback(err);
        });
    }
    continueProcessWithRecovery(recoveryQueue, recoveryMessage, recoveryTimeout = null, callback) {
        this.checkCurrentProcess();
        this.checkProcessStage(TaskProcessStage_1.TaskProcessStage.Processed);
        let correlationId = this.getCorrelationId();
        async.series([
            (callback) => {
                if (recoveryQueue == null) {
                    callback(new Error('Recovery queue is not defined'));
                    return;
                }
                var message = this.toMessage(recoveryMessage);
                if (message == null) {
                    callback(new Error('Recovery message cannot be null'));
                    return;
                }
                recoveryTimeout = recoveryTimeout !== null && recoveryTimeout !== void 0 ? recoveryTimeout : this._parameters.getAsNullableInteger(ProcessParam_1.ProcessParam.RecoveryTimeout);
                this._processStatesClient.continueAndRecoverProcess(correlationId, this.processState, recoveryQueue, message, recoveryTimeout, (err) => {
                    callback(err);
                });
            },
            (callback) => {
                this.processStage = TaskProcessStage_1.TaskProcessStage.Processed;
                this.queue.complete(this.message, (err) => {
                    this._logger.debug(correlationId, 'Continued process %s with recovery', this.name);
                    callback(err);
                });
            }
        ], (err) => {
            if (err) {
                this._logger.error(correlationId, err, 'Failed to continue process %s', this.name);
            }
            callback(err);
        });
    }
    repeatProcessRecovery(recoveryTimeout = null, callback) {
        this.checkCurrentProcess();
        this.checkProcessStage(TaskProcessStage_1.TaskProcessStage.Processed);
        let correlationId = this.getCorrelationId();
        async.series([
            (callback) => {
                recoveryTimeout = recoveryTimeout !== null && recoveryTimeout !== void 0 ? recoveryTimeout : this._parameters.getAsNullableInteger(ProcessParam_1.ProcessParam.RecoveryTimeout);
                this._processStatesClient.repeatProcessRecovery(correlationId, this.processState, recoveryTimeout, (err) => {
                    callback(err);
                });
            },
            (callback) => {
                this.processStage = TaskProcessStage_1.TaskProcessStage.Processed;
                this.queue.complete(this.message, (err) => {
                    this._logger.debug(correlationId, 'Repeated recovery for process %s', this.name);
                    callback(err);
                });
            }
        ], (err) => {
            if (err) {
                this._logger.error(correlationId, err, 'Failed to repeat recovery for process %s', this.name);
            }
            callback(err);
        });
    }
    requestResponseForProcess(request, recoveryQueue, recoveryMessage, callback) {
        this.checkCurrentProcess();
        this.checkProcessStage(TaskProcessStage_1.TaskProcessStage.Processed);
        let correlationId = this.getCorrelationId();
        async.series([
            (callback) => {
                if (recoveryQueue == null) {
                    callback(new Error('Recovery queue is not defined'));
                    return;
                }
                var message = this.toMessage(recoveryMessage);
                if (message == null) {
                    callback(new Error('Recovery message cannot be null'));
                    return;
                }
                this._processStatesClient.requestProcessForResponse(correlationId, this.processState, request, recoveryQueue, message, (err) => {
                    callback(err);
                });
            },
            (callback) => {
                this.processStage = TaskProcessStage_1.TaskProcessStage.Processed;
                this.queue.complete(this.message, (err) => {
                    this._logger.debug(correlationId, 'Requested for response on process %s', this.name);
                    callback(err);
                });
            }
        ], (err) => {
            if (err) {
                this._logger.error(correlationId, err, 'Failed to request for response on process %s', this.name);
            }
            callback(err);
        });
    }
    failAndContinueProcess(errorMessage, callback) {
        this.checkCurrentProcess();
        this.checkProcessStage(TaskProcessStage_1.TaskProcessStage.Processed);
        let correlationId = this.getCorrelationId();
        async.series([
            (callback) => {
                this._processStatesClient.failAndContinueProcess(correlationId, this.processState, errorMessage, (err) => {
                    callback(err);
                });
            },
            (callback) => {
                this.processStage = TaskProcessStage_1.TaskProcessStage.Processed;
                this.queue.complete(this.message, (err) => {
                    this._logger.debug(correlationId, 'Failed and continue process %s', this.name);
                    callback(err);
                });
            }
        ], (err) => {
            if (err) {
                this._logger.error(correlationId, err, 'Failed to fail and continue process %s', this.name);
            }
            callback(err);
        });
    }
    failAndRetryProcess(errorMessage, callback) {
        this.checkCurrentProcess();
        this.checkProcessStage(TaskProcessStage_1.TaskProcessStage.Processed);
        let correlationId = this.getCorrelationId();
        async.series([
            (callback) => {
                this._processStatesClient.failAndContinueProcess(correlationId, this.processState, errorMessage, (err) => {
                    callback(err);
                });
            },
            (callback) => {
                this.processStage = TaskProcessStage_1.TaskProcessStage.Processed;
                this.queue.abandon(this.message, (err) => {
                    this._logger.debug(correlationId, 'Failed and retry process %s', this.name);
                    callback(err);
                });
            }
        ], (err) => {
            if (err) {
                this._logger.error(correlationId, err, 'Failed to fail and retry process %s', this.name);
            }
            callback(err);
        });
    }
    failAndRecoverProcess(errorMessage, recoveryQueue, recoveryMessage, recoveryTimeout = null, callback) {
        this.checkCurrentProcess();
        this.checkProcessStage(TaskProcessStage_1.TaskProcessStage.Processed);
        let correlationId = this.getCorrelationId();
        async.series([
            (callback) => {
                if (recoveryQueue == null) {
                    callback(new Error('Recovery queue is not defined'));
                    return;
                }
                var message = this.toMessage(recoveryMessage);
                if (message == null) {
                    callback(new Error('Recovery message cannot be null'));
                    return;
                }
                recoveryTimeout = recoveryTimeout !== null && recoveryTimeout !== void 0 ? recoveryTimeout : this._parameters.getAsNullableInteger(ProcessParam_1.ProcessParam.RecoveryTimeout);
                this._processStatesClient.failAndRecoverProcess(correlationId, this.processState, errorMessage, recoveryQueue, message, recoveryTimeout, (err) => {
                    callback(err);
                });
            },
            (callback) => {
                this.processStage = TaskProcessStage_1.TaskProcessStage.Processed;
                this.queue.complete(this.message, (err) => {
                    this._logger.debug(correlationId, 'Failed and recovery process %s', this.name);
                    callback(err);
                });
            }
        ], (err) => {
            if (err) {
                this._logger.error(correlationId, err, 'Failed to fail and recovery process %s', this.name);
            }
            callback(err);
        });
    }
    failProcess(errorMessage, callback) {
        this.checkCurrentProcess();
        this.checkProcessStage(TaskProcessStage_1.TaskProcessStage.Processed);
        let correlationId = this.getCorrelationId();
        let settingsSection = this.getSettingsSection();
        async.series([
            (callback) => {
                this._processStatesClient.failProcess(correlationId, this.processState, errorMessage, (err) => {
                    callback(err);
                });
            },
            (callback) => {
                this.processStage = TaskProcessStage_1.TaskProcessStage.Processed;
                this.queue.complete(this.message, (err) => {
                    callback(err);
                });
            },
            (callback) => {
                // Write status
                if (settingsSection != null) {
                    callback();
                    return;
                }
                this._settingsClient.modifySection(correlationId, settingsSection, pip_services3_commons_node_1.ConfigParams.fromTuples('LastFailedTimeUtc', new Date(Date.now())), pip_services3_commons_node_1.ConfigParams.fromTuples('FailedProcesss', 1), (err, parameters) => {
                    callback(err);
                });
            }
        ], (err) => {
            if (err)
                this._logger.error(correlationId, err, 'Failed to fail process %s', this.name);
            else
                this._logger.debug(correlationId, 'Failed process %s', this.name);
            callback(err);
        });
    }
    completeProcess(callback) {
        this.checkCurrentProcess();
        this.checkProcessStage(TaskProcessStage_1.TaskProcessStage.Processed);
        let correlationId = this.getCorrelationId();
        let settingsSection = this.getSettingsSection();
        async.series([
            (callback) => {
                this._processStatesClient.completeProcess(correlationId, this.processState, (err) => {
                    callback(err);
                });
            },
            (callback) => {
                this.processStage = TaskProcessStage_1.TaskProcessStage.Processed;
                this.queue.complete(this.message, (err) => {
                    callback(err);
                });
            },
            (callback) => {
                // Write status
                if (settingsSection != null) {
                    callback();
                    return;
                }
                this._settingsClient.modifySection(correlationId, settingsSection, pip_services3_commons_node_1.ConfigParams.fromTuples('LastCompletedTimeUtc', new Date(Date.now())), pip_services3_commons_node_1.ConfigParams.fromTuples('CompletedProcesss', 1), (err, parameters) => {
                    callback(err);
                });
            }
        ], (err) => {
            if (err)
                this._logger.error(correlationId, err, 'Failed to complete process %s', this.name);
            else
                this._logger.debug(correlationId, 'Completed process %s', this.name);
            callback(err);
        });
    }
    abortProcess(errorMessage, callback) {
        this.checkCurrentProcess();
        this.checkProcessStage(TaskProcessStage_1.TaskProcessStage.Processed);
        let correlationId = this.getCorrelationId();
        let settingsSection = this.getSettingsSection();
        async.series([
            (callback) => {
                this.taskState.error_message = errorMessage;
                this._processStatesClient.abortProcess(correlationId, this.processState, errorMessage, (err) => {
                    callback(err);
                });
            },
            (callback) => {
                this.processStage = TaskProcessStage_1.TaskProcessStage.Processed;
                this.queue.complete(this.message, (err) => {
                    callback(err);
                });
            },
            (callback) => {
                // Write status
                if (settingsSection != null) {
                    callback();
                    return;
                }
                this._settingsClient.modifySection(correlationId, settingsSection, pip_services3_commons_node_1.ConfigParams.fromTuples('LastAbortedTimeUtc', new Date(Date.now())), pip_services3_commons_node_1.ConfigParams.fromTuples('AbortedProcesss', 1), (err, parameters) => {
                    callback(err);
                });
            }
        ], (err) => {
            if (err)
                this._logger.error(correlationId, err, 'Failed to abort process %s', this.name);
            else
                this._logger.debug(correlationId, 'Aborted process %s', this.name);
            callback(err);
        });
    }
    getProcessDataAs(key) {
        this.checkCurrentProcess();
        var processData = this.getProcessData();
        var data = processData.get(key);
        var correlationId = this.getCorrelationId();
        this._logger.debug(correlationId, 'Get process data for key %s: %s', key, data);
        return data ? JSON.parse(data) : undefined;
    }
    setProcessData(key, data) {
        this.checkCurrentProcess();
        var correlationId = this.getCorrelationId();
        this._logger.debug(correlationId, 'Set process data for key %s: %s', key, data);
        var processData = this.getProcessData();
        processData.set(key, JSON.stringify(data));
    }
    readSettings(section, callback) {
        var settingsSection = this.getSettingsSection(section);
        var correlationId = this.getCorrelationId();
        this._settingsClient.getSectionById(correlationId, settingsSection, (err, parameters) => {
            callback(err, parameters);
        });
    }
    writeSettings(section, settings, callback) {
        var settingsSection = this.getSettingsSection(section);
        var correlationId = this.getCorrelationId();
        this._settingsClient.setSection(correlationId, settingsSection, settings, (err, parameters) => {
            callback(err, parameters);
        });
    }
    writeSettingsKey(section, key, value, callback) {
        var settingsSection = this.getSettingsSection(section);
        var correlationId = this.getCorrelationId();
        this._logger.debug(correlationId, 'Write storage settings for key %s: %s', key, value === null || value === void 0 ? void 0 : value.toString());
        this._settingsClient.modifySection(correlationId, settingsSection, pip_services3_commons_node_1.ConfigParams.fromTuples(key, value), null, (err, parameters) => {
            callback(err, parameters);
        });
    }
    addMapping(collection, internalId, externalId, timeToLive = null, callback) {
        var correlationId = this.getCorrelationId();
        this._mappingsClient.addMapping(correlationId, collection, internalId, externalId, timeToLive, (err) => {
            callback(err);
        });
    }
    mapToExternal(collection, internalId, callback) {
        var correlationId = this.getCorrelationId();
        this._mappingsClient.mapToExternal(correlationId, collection, internalId, (err, externalId) => {
            callback(err, externalId);
        });
    }
    mapToInternal(collection, externalId, callback) {
        var correlationId = this.getCorrelationId();
        this._mappingsClient.mapToInternal(correlationId, collection, externalId, (err, internalId) => {
            callback(err, internalId);
        });
    }
    getProcessData() {
        var processData = this.processState.data;
        if (!processData) {
            this.processState.data = new Map();
            processData = this.processState.data;
        }
        return processData;
    }
    checkErrorType(err, errorClass) {
        var typedError = new errorClass();
        var typedErrorCode = typedError && typedError.hasOwnProperty('code') ? typedError['code'] : null;
        var errCode = err && err.hasOwnProperty('code') ? err['code'] : null;
        return typedErrorCode != null && errCode != null && typedErrorCode === errCode;
    }
}
exports.Task = Task;
//# sourceMappingURL=Task.js.map