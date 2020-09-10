let async = require('async');

import { IReferenceable, IParameterized, IReferences, Parameters, Schema, ConfigParams, AnyValueMap } from 'pip-services3-commons-node';
import { IMessageQueue } from 'pip-services3-messaging-node';
import { MessageEnvelope } from 'pip-services3-messaging-node';
import { ICounters, ILogger, CompositeLogger, CompositeCounters, LogLevel } from 'pip-services3-components-node';
import { ITempBlobsClientV1 } from 'pip-clients-tempblobs-node';
import { IEventLogClientV1 } from 'pip-clients-eventlog-node';
import { ISettingsClientV1 } from 'pip-clients-settings-node';
import { IMappingsClient } from 'pip-clients-mappings-node';
import { KnownDescriptors } from './KnownDescriptors';
import { TaskStateV1, ProcessStateV1, TaskStatusV1, IProcessStatesClient, MessageV1, ProcessInvalidStateExceptionV1 } from 'pip-clients-processstates-node';
import { TaskProcessStage } from './TaskProcessStage';
import { ProcessParam } from './ProcessParam';
import { IRetriesClientV1 } from 'pip-clients-retries-node';

/*
process -> Process
workflowStatus -> ProcessStates
Activity -> Task
ActivityStatus -> TaskStateV1
Recovery -> Recovery
*/
export abstract class Task implements IReferenceable, IParameterized {

    private _references: IReferences;
    protected _parameters: Parameters;
    protected _logger: ILogger;
    private _counters: ICounters;

    protected _settingsClient: ISettingsClientV1;
    protected _eventLogClient: IEventLogClientV1;
    protected _processStatesClient: IProcessStatesClient;
    protected _mappingsClient: IMappingsClient;
    protected _tempBlobClient: ITempBlobsClientV1;
    protected _retriesClient: IRetriesClientV1;

    public name: string;
    public message: MessageEnvelope;
    public queue: IMessageQueue;

    public processId: string;
    public processKey: string;
    public processType: string;
    public processStage: number;
    public processState: ProcessStateV1;

    public taskType: string;
    public taskState: TaskStateV1;

    public statusSection: string;
    public correlationId: string;

    constructor() {
    }

    public initialize(processType: string, taskType: string,
        message: MessageEnvelope, queue: IMessageQueue,
        references: IReferences, parameters: Parameters,
        callback: (err: any) => void): void {

        if (processType == null) {
            callback(new Error('Process type cannot be null'));
            return;
        }

        if (taskType == null) {
            callback(new Error('Activity type cannot be null'));
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
        this.processStage = TaskProcessStage.Started;

        this.setReferences(references);
        this.setParameters(parameters);

        this.statusSection = processType + '.Status';

        let settingsSection = this.getSettingsSection();
        let correlationId = this.getCorrelationId();

        this._settingsClient.setSection(correlationId, settingsSection,
            ConfigParams.fromTuples('LastActivationTimeUtc', new Date(Date.now())), (err, parameters) => {
                callback(err);
            });
    }

    setReferences(references: IReferences): void {
        this._references = references;

        this._logger = new CompositeLogger(references);
        this._counters = new CompositeCounters();

        this._settingsClient = this._references.getOneRequired<ISettingsClientV1>(KnownDescriptors.Settings);
        this._eventLogClient = this._references.getOneRequired<IEventLogClientV1>(KnownDescriptors.EventLog);
        this._processStatesClient = this._references.getOneRequired<IProcessStatesClient>(KnownDescriptors.ProcessStates);
        this._mappingsClient = this._references.getOneRequired<IMappingsClient>(KnownDescriptors.Mappings);
        this._tempBlobClient = this._references.getOneRequired<ITempBlobsClientV1>(KnownDescriptors.TempBlobs);
        this._retriesClient = this._references.getOneRequired<IRetriesClientV1>(KnownDescriptors.Retries);
    }

    setParameters(parameters: Parameters): void {
        this._parameters = (parameters ?? new Parameters()).override(parameters);

        this.correlationId = this._parameters.getAsStringWithDefault('correlation_id', this.correlationId);
    }

    public abstract execute(callback: (err: any) => void): void;

    private getCorrelationId(): string {
        return this.processId ?? this.correlationId;
    }

    private getSettingsSection(section?: string): string {
        return (section ?? this.statusSection) + '.' + this.processId;
    }

    protected toMessageEnvelope(message: any): MessageEnvelope {
        if (message == null)
            return null;

        if (message.constructor.name === 'MessageEnvelope')
            return message;

        return new MessageEnvelope(this.processId ?? this.correlationId, null, message);
    }

    public sendMessage(queueName: string, message: any, callback: (err: any) => void) {
        var queue = this._references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue(queueName));
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

    public completeMessage(callback: (err: any) => void) {
        this.queue.complete(this.message, callback);
    }

    public abandonMessage(callback: (err: any) => void) {
        this.queue.abandon(this.message, callback);
    }

    public moveMessageToDead(callback: (err: any) => void) {
        this.queue.moveToDeadLetter(this.message, callback);
    }

    public logMessage(level: LogLevel, message: string) {
        this._logger.log(level, this.processId, null, message);
    }

    public logError(ex: Error, message: string) {
        this._logger.error(this.processId, ex, message);
    }

    public validateMessage(message: MessageEnvelope, schema: Schema) {
        if (message == null)
            throw new Error('Message cannot be null');

        // Validate and throw validation exception
        if (schema != null)
            schema.validateAndThrowException(null, message);
    }

    private checkCurrentProcess() {
        if (this.processState == null || this.taskState == null)
            throw new Error('Process is not started or activated');
    }

    private checkProcessStage(stage: number) {
        if (stage == TaskProcessStage.Processing && (this.processStage >= stage))
            throw new ProcessInvalidStateExceptionV1('Process can be started of activated only once');
        if (stage == TaskProcessStage.Processed && (this.processStage >= stage))
            throw new ProcessInvalidStateExceptionV1('Process activity can be closed only once');
    }

    private getCurrentTask(): TaskStateV1 {
        let tasks = this.processState.tasks.filter(
            a => a.status == TaskStatusV1.Executing && a.type == this.taskType
        );

        return tasks.length == 1 ? tasks[0] : null;
    }

    private toMessage(envelope: MessageEnvelope): MessageV1 {
        let message: MessageV1 = {
            correlation_id: envelope.correlation_id,
            message: envelope.message?.toString(),
            message_id: envelope.message_id,
            message_type: envelope.message_type,
            sent_time: envelope.sent_time
        };

        return message;
    }

    public startProcess(processKey: string = null, callback: (err: any, state: ProcessStateV1) => void) {
        this.checkProcessStage(TaskProcessStage.Processing);

        let correlationId = this.getCorrelationId();
        let timeToLive = this._parameters.getAsNullableInteger(ProcessParam.ProcessTimeToLive);
        let message = this.toMessage(this.message);
        let settingsSection = this.getSettingsSection();

        async.series(
            (callback) => {
                // Start activity
                this._processStatesClient.startProcess(correlationId,
                    this.processType, processKey, this.taskType, this.queue.getName(), message, timeToLive, (err, state) => {
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

                // Set current activity info
                this.taskState = this.getCurrentTask();
                this.taskState.queue_name = this.queue.getName();
                this.taskState.message = message;

                this.processStage = TaskProcessStage.Processing;

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
                }

                this._settingsClient.setSection(correlationId, settingsSection,
                    ConfigParams.fromTuples('LastStartedTimeUtc', new Date(Date.now())), (err, parameters) => {
                        callback(err);
                    });
            },
            (callback) => {
                // Write status
                if (this.statusSection != null) {
                    callback();
                }

                this._settingsClient.modifySection(correlationId, settingsSection, null,
                    ConfigParams.fromTuples('StartedProcesss', 1), (err, parameters) => {
                        callback(err);
                    });
            },
            (err) => {
                if (err) {
                    this._logger.error(correlationId, err, 'Failed to start process %s', this.name);
                }

                callback(err, this.processState);
            }
        );
    }

    public activateOrStartProcessWithKey(processKey: string, callback: (err: any, state: ProcessStateV1) => void) {
        this.checkProcessStage(TaskProcessStage.Processing);

        if (processKey == null) {
            callback(new Error('Process key cannot be null'), null);
            return;
        }

        let correlationId = this.getCorrelationId();
        let timeToLive = this._parameters.getAsNullableInteger(ProcessParam.ProcessTimeToLive);
        let message = this.toMessage(this.message);
        let settingsSection = this.getSettingsSection();

        async.series([
            (callback) => {
                // Call the service and start process
                this._processStatesClient.activateOrStartProcess(correlationId,
                    this.processType, processKey, this.taskType, this.queue.getName(), message, timeToLive, (err, state) => {
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

                // Set current activity info
                this.taskState = this.getCurrentTask();
                this.taskState.queue_name = this.queue.getName();
                this.taskState.message = message;

                this.processStage = TaskProcessStage.Processing;

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
                }

                this._settingsClient.setSection(correlationId, settingsSection,
                    ConfigParams.fromTuples('LastStartedTimeUtc', new Date(Date.now())), (err, parameters) => {
                        callback(err);
                    });
            },
            (callback) => {
                // Write status
                if (this.statusSection != null) {
                    callback();
                }

                this._settingsClient.modifySection(correlationId, settingsSection, null,
                    ConfigParams.fromTuples('StartedProcesss', 1), (err, parameters) => {
                        callback(err);
                    });
            }],
            (err) => {
                if (err) {
                    if (processKey != null)
                        this._logger.error(correlationId, err, 'Failed to start or reactivate process %s with key %s', this.name, processKey);
                    else
                        this._logger.error(correlationId, err, 'Failed to start or reactivate process %s', this.name);
                }

                callback(err, this.processState);
            }
        );
    }

    public activateProcess(processId: string = null, callback: (err: any, state: ProcessStateV1) => void) {
        this.checkProcessStage(TaskProcessStage.Processing);

        let correlationId = this.getCorrelationId();
        let message = this.toMessage(this.message);

        async.series([
            (callback) => {
                // Call the service and start process
                this._processStatesClient.activateProcess(correlationId,
                    processId, this.taskType, this.queue.getName(), message, (err, state) => {
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

                this.processStage = TaskProcessStage.Processing;

                this._logger.debug(processId, 'Activited process %s', this.name);

                callback();
            }],
            (err) => {
                if (err) {
                    this._logger.error(correlationId, err, 'Failed to activate process %s', this.name);
                }

                callback(err, this.processState);
            }
        );
    }

    public activateProcessWithKey(processKey: string, callback: (err: any, state: ProcessStateV1) => void) {
        if (processKey == null) {
            callback(new Error('Process key cannot be null'), null);
            return;
        }

        this.checkProcessStage(TaskProcessStage.Processing);

        let correlationId = this.getCorrelationId();
        let message = this.toMessage(this.message);

        async.series([
            (callback) => {
                // Call the service and activate process
                this._processStatesClient.activateProcessByKey(correlationId,
                    this.processType, processKey, this.taskType, this.queue.getName(), message, (err, state) => {
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

                // Set current activity info
                this.taskState = this.getCurrentTask();
                this.taskState.queue_name = this.queue.getName();
                this.taskState.message = message;

                this.processStage = TaskProcessStage.Processing;

                this._logger.debug(correlationId, 'Activited process %s with key %s', this.name, processKey);

                callback();
            }],
            (err) => {
                if (err) {
                    this._logger.error(correlationId, err, 'Failed to activate process %s with key %s', this.name, processKey);
                }

                callback(err, this.processState);
            }
        );
    }

    public rollbackProcess(errorMessage: string, callback: (err: any) => void) {
        let correlationId = this.getCorrelationId();

        async.series([
            (callback) => {
                if (this.processState != null && this.taskState != null) {
                    this.taskState.error_message = errorMessage;

                    this._processStatesClient.rollbackProcess(correlationId,
                        this.processState, (err) => {
                            callback(err);
                        });

                }
            },
            (callback) => {
                this.processStage = TaskProcessStage.Processed;

                this.queue.abandon(this.message, (err) => {
                    this._logger.debug(correlationId, 'Rollbacked process %s: %s', this.name, errorMessage);
                    callback(err);
                });
            }],
            (err) => {
                if (err) {
                    this._logger.error(correlationId, err, 'Failed to rollback process %s', this.name);
                }

                callback(err);
            }
        );
    }

    public continueProcess(callback: (err: any) => void) {
        this.checkCurrentProcess();
        this.checkProcessStage(TaskProcessStage.Processed);

        let correlationId = this.getCorrelationId();

        async.series([
            (callback) => {
                this._processStatesClient.continueProcess(correlationId,
                    this.processState, (err) => {
                        callback(err);
                    });
            },
            (callback) => {
                this.processStage = TaskProcessStage.Processed;

                this.queue.complete(this.message, (err) => {
                    this._logger.debug(correlationId, 'Continued process %s', this.name);
                    callback(err);
                });
            }],
            (err) => {
                if (err) {
                    this._logger.error(correlationId, err, 'Failed to continue process %s', this.name);
                }

                callback(err);
            }
        );
    }

    public continueProcessWithRecovery(recoveryQueue: string, recoveryMessage: MessageEnvelope, recoveryTimeout: number = null, callback: (err: any) => void) {
        this.checkCurrentProcess();
        this.checkProcessStage(TaskProcessStage.Processed);

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

                recoveryTimeout = recoveryTimeout
                    ?? this._parameters.getAsNullableInteger(ProcessParam.RecoveryTimeout);

                this._processStatesClient.continueAndRecoverProcess(correlationId,
                    this.processState, recoveryQueue, message, recoveryTimeout, (err) => {
                        callback(err);
                    });
            },
            (callback) => {
                this.processStage = TaskProcessStage.Processed;

                this.queue.complete(this.message, (err) => {
                    this._logger.debug(correlationId, 'Continued process %s with recovery', this.name);
                    callback(err);
                });
            }],
            (err) => {
                if (err) {
                    this._logger.error(correlationId, err, 'Failed to continue process %s', this.name);
                }

                callback(err);
            }
        );
    }

    public repeatProcessRecovery(recoveryTimeout: number = null, callback: (err: any) => void) {
        this.checkCurrentProcess();
        this.checkProcessStage(TaskProcessStage.Processed);

        let correlationId = this.getCorrelationId();

        async.series([
            (callback) => {

                recoveryTimeout = recoveryTimeout
                    ?? this._parameters.getAsNullableInteger(ProcessParam.RecoveryTimeout);

                this._processStatesClient.repeatProcessRecovery(correlationId,
                    this.processState, recoveryTimeout, (err) => {
                        callback(err);
                    });
            },
            (callback) => {
                this.processStage = TaskProcessStage.Processed;

                this.queue.complete(this.message, (err) => {
                    this._logger.debug(correlationId, 'Repeated recovery for process %s', this.name);
                    callback(err);
                });
            }],
            (err) => {
                if (err) {
                    this._logger.error(correlationId, err, 'Failed to repeat recovery for process %s', this.name);
                }

                callback(err);
            }
        );
    }

    public requestResponseForProcess(request: string, recoveryQueue: string, recoveryMessage: MessageEnvelope, callback: (err: any) => void) {
        this.checkCurrentProcess();
        this.checkProcessStage(TaskProcessStage.Processed);

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

                this._processStatesClient.requestProcessForResponse(correlationId,
                    this.processState, request, recoveryQueue, message, (err) => {
                        callback(err);
                    });
            },
            (callback) => {
                this.processStage = TaskProcessStage.Processed;

                this.queue.complete(this.message, (err) => {
                    this._logger.debug(correlationId, 'Requested for response on process %s', this.name);
                    callback(err);
                });
            }],
            (err) => {
                if (err) {
                    this._logger.error(correlationId, err, 'Failed to request for response on process %s', this.name);
                }

                callback(err);
            }
        );
    }

    public failAndContinueProcess(errorMessage: string, callback: (err: any) => void) {
        this.checkCurrentProcess();
        this.checkProcessStage(TaskProcessStage.Processed);

        let correlationId = this.getCorrelationId();

        async.series([
            (callback) => {

                this._processStatesClient.failAndContinueProcess(correlationId,
                    this.processState, errorMessage, (err) => {
                        callback(err);
                    });
            },
            (callback) => {
                this.processStage = TaskProcessStage.Processed;

                this.queue.complete(this.message, (err) => {
                    this._logger.debug(correlationId, 'Failed and continue process %s', this.name);
                    callback(err);
                });
            }],
            (err) => {
                if (err) {
                    this._logger.error(correlationId, err, 'Failed to fail and continue process %s', this.name);
                }

                callback(err);
            }
        );
    }

    public failAndRetryProcess(errorMessage: string, callback: (err: any) => void) {
        this.checkCurrentProcess();
        this.checkProcessStage(TaskProcessStage.Processed);

        let correlationId = this.getCorrelationId();

        async.series([
            (callback) => {

                this._processStatesClient.failAndContinueProcess(correlationId,
                    this.processState, errorMessage, (err) => {
                        callback(err);
                    });
            },
            (callback) => {
                this.processStage = TaskProcessStage.Processed;

                this.queue.abandon(this.message, (err) => {
                    this._logger.debug(correlationId, 'Failed and retry process %s', this.name);
                    callback(err);
                });
            }],
            (err) => {
                if (err) {
                    this._logger.error(correlationId, err, 'Failed to fail and retry process %s', this.name);
                }

                callback(err);
            }
        );
    }

    public failAndRecoverProcess(errorMessage: string, recoveryQueue: string, recoveryMessage: MessageEnvelope, recoveryTimeout: number = null,
        callback: (err: any) => void) {
        this.checkCurrentProcess();
        this.checkProcessStage(TaskProcessStage.Processed);

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

                recoveryTimeout = recoveryTimeout
                    ?? this._parameters.getAsNullableInteger(ProcessParam.RecoveryTimeout);

                this._processStatesClient.failAndRecoverProcess(correlationId,
                    this.processState, errorMessage, recoveryQueue, message, recoveryTimeout, (err) => {
                        callback(err);
                    });
            },
            (callback) => {
                this.processStage = TaskProcessStage.Processed;

                this.queue.complete(this.message, (err) => {
                    this._logger.debug(correlationId, 'Failed and recovery process %s', this.name);
                    callback(err);
                });
            }],
            (err) => {
                if (err) {
                    this._logger.error(correlationId, err, 'Failed to fail and recovery process %s', this.name);
                }

                callback(err);
            }
        );
    }

    public failProcess(errorMessage: string, callback: (err: any) => void) {
        this.checkCurrentProcess();
        this.checkProcessStage(TaskProcessStage.Processed);

        let correlationId = this.getCorrelationId();
        let settingsSection = this.getSettingsSection();

        async.series([
            (callback) => {
                this._processStatesClient.failProcess(correlationId,
                    this.processState, errorMessage, (err) => {
                        callback(err);
                    });
            },
            (callback) => {
                this.processStage = TaskProcessStage.Processed;

                this.queue.complete(this.message, (err) => {
                    callback(err);
                });
            },
            (callback) => {
                // Write status
                if (settingsSection != null) {
                    callback();
                }

                this._settingsClient.modifySection(correlationId, settingsSection,
                    ConfigParams.fromTuples('LastFailedTimeUtc', new Date(Date.now())),
                    ConfigParams.fromTuples('FailedProcesss', 1), (err, parameters) => {
                        callback(err);
                    });
            }],
            (err) => {
                if (err)
                    this._logger.error(correlationId, err, 'Failed to fail process %s', this.name);
                else
                    this._logger.debug(correlationId, 'Failed process %s', this.name);

                callback(err);
            }
        );
    }

    public completeProcess(callback: (err: any) => void) {
        this.checkCurrentProcess();
        this.checkProcessStage(TaskProcessStage.Processed);

        let correlationId = this.getCorrelationId();
        let settingsSection = this.getSettingsSection();

        async.series([
            (callback) => {
                this._processStatesClient.completeProcess(correlationId,
                    this.processState, (err) => {
                        callback(err);
                    });
            },
            (callback) => {
                this.processStage = TaskProcessStage.Processed;

                this.queue.complete(this.message, (err) => {
                    callback(err);
                });
            },
            (callback) => {
                // Write status
                if (settingsSection != null) {
                    callback();
                }

                this._settingsClient.modifySection(correlationId, settingsSection,
                    ConfigParams.fromTuples('LastCompletedTimeUtc', new Date(Date.now())),
                    ConfigParams.fromTuples('CompletedProcesss', 1), (err, parameters) => {
                        callback(err);
                    });
            }],
            (err) => {
                if (err)
                    this._logger.error(correlationId, err, 'Failed to complete process %s', this.name);
                else
                    this._logger.debug(correlationId, 'Completed process %s', this.name);

                callback(err);
            }
        );
    }

    public abortProcess(errorMessage: string, callback: (err: any) => void) {
        this.checkCurrentProcess();
        this.checkProcessStage(TaskProcessStage.Processed);

        let correlationId = this.getCorrelationId();
        let settingsSection = this.getSettingsSection();

        async.series([
            (callback) => {
                this.taskState.error_message = errorMessage;

                this._processStatesClient.abortProcess(correlationId,
                    this.processState, errorMessage, (err) => {
                        callback(err);
                    });
            },
            (callback) => {
                this.processStage = TaskProcessStage.Processed;

                this.queue.complete(this.message, (err) => {
                    callback(err);
                });
            },
            (callback) => {
                // Write status
                if (settingsSection != null) {
                    callback();
                }

                this._settingsClient.modifySection(correlationId, settingsSection,
                    ConfigParams.fromTuples('LastAbortedTimeUtc', new Date(Date.now())),
                    ConfigParams.fromTuples('AbortedProcesss', 1), (err, parameters) => {
                        callback(err);
                    });
            }],
            (err) => {
                if (err)
                    this._logger.error(correlationId, err, 'Failed to abort process %s', this.name);
                else
                    this._logger.debug(correlationId, 'Aborted process %s', this.name);

                callback(err);
            }
        );
    }

    public getProcessDataAs<T>(key: string): T {
        this.checkCurrentProcess();

        var processData = this.getProcessData();

        var data = processData.getAsObject(key) as T;

        var correlationId = this.getCorrelationId();
        this._logger.debug(correlationId, 'Get process data for key %s: %s', key, data);

        return data;
    }

    public setProcessData(key: string, data: any) {
        this.checkCurrentProcess();

        var correlationId = this.getCorrelationId();
        this._logger.debug(correlationId, 'Set process data for key %s: %s', key, data);

        var processData = this.getProcessData();

        processData.setAsObject(key, data);
    }

    public readSettings(section: string, callback: (err: any, settings: ConfigParams) => void) {
        var settingsSection = this.getSettingsSection(section);
        var correlationId = this.getCorrelationId();

        this._settingsClient.getSectionById(correlationId, settingsSection, (err, parameters) => {
            callback(err, parameters);
        });
    }

    public writeSettings(section: string, settings: ConfigParams, callback: (err: any, settings: ConfigParams) => void) {
        var settingsSection = this.getSettingsSection(section);
        var correlationId = this.getCorrelationId();

        this._settingsClient.setSection(correlationId, settingsSection, settings, (err, parameters) => {
            callback(err, parameters);
        });
    }

    public writeSettingsKey(section: string, key: string, value: any, callback: (err: any, settings: ConfigParams) => void) {
        var settingsSection = this.getSettingsSection(section);
        var correlationId = this.getCorrelationId();

        this._logger.debug(correlationId, 'Write storage settings for key %s: %s', key, value?.ToString());

        this._settingsClient.modifySection(correlationId, settingsSection, ConfigParams.fromTuples(key, value), null, (err, parameters) => {
            callback(err, parameters);
        });
    }

    public addMapping(collection: string, internalId: string, externalId: string, timeToLive: number = null, callback: (err: any) => void) {
        var correlationId = this.getCorrelationId();

        this._mappingsClient.addMapping(correlationId, collection, internalId, externalId, timeToLive, (err) => {
            callback(err);
        });
    }

    public mapToExternal(collection: string, internalId: string, callback: (err: any, externalId: string) => void) {
        var correlationId = this.getCorrelationId();

        this._mappingsClient.mapToExternal(correlationId, collection, internalId, (err, externalId) => {
            callback(err, externalId);
        });
    }

    public mapToInternal(collection: string, externalId: string, callback: (err: any, internalId: string) => void) {
        var correlationId = this.getCorrelationId();

        this._mappingsClient.mapToInternal(correlationId, collection, externalId, (err, internalId) => {
            callback(err, internalId);
        });
    }

    protected getTypeName<T>(): string {
        var TCtor: new (...args: any[]) => T;
        var typeName = typeof (TCtor).name;

        return typeName;
    }

    private getProcessData(): AnyValueMap {
        var processData = this.processState.data as AnyValueMap;

        if (!processData) {
            this.processState.data = new AnyValueMap();
            processData = this.processState.data;
        }

        return processData;
    }
}