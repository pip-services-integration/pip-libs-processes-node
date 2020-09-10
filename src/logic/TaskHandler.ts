let async = require('async');

import { IReferences, Descriptor } from 'pip-services3-commons-node';
import { Parameters } from 'pip-services3-commons-node';
import { CompositeLogger, Timing } from 'pip-services3-components-node';
import { CompositeCounters } from 'pip-services3-components-node';
import { IMessageQueue } from 'pip-services3-messaging-node';
import { MessageEnvelope } from 'pip-services3-messaging-node';

import { IEventLogClientV1, SystemEventV1, EventLogSeverityV1 } from 'pip-clients-eventlog-node';
import { EventLogTypeV1 } from 'pip-clients-eventlog-node';
import { IRetriesClientV1 } from 'pip-clients-retries-node';
import { ISettingsClientV1 } from 'pip-clients-settings-node';

import { ITaskHandler } from './ITaskHandler';
import { Task } from './Task';
import { ProcessParam } from './ProcessParam';
import { ProcessLockedExceptionV1 } from 'pip-clients-processstates-node';
import { TaskProcessStage } from './TaskProcessStage';

// public class TaskHandler<T>: TaskHandler
// {
//     public TaskHandler(string processType, string taskType, IMessageQueue queue,
//         IReferences references, Parameters parameters)
//         : base(processType, taskType, typeof(T), queue, references, parameters)
//     { }
// }

export class TaskHandler implements ITaskHandler {
    public maxNumberOfAttempts: number = 5;
    private _cancel: boolean = false;
    private _references: IReferences;
    private _logger: CompositeLogger = new CompositeLogger();
    private _counters: CompositeCounters = new CompositeCounters();

    private _eventLogClient: IEventLogClientV1;
    private _settingsClient: ISettingsClientV1;
    private _retriesClient: IRetriesClientV1;

    public name: string;
    public queue: IMessageQueue;
    public processType: string;
    public taskType: string;
    public taskClass: any;

    public parameters: Parameters;
    public disabled: boolean;
    public correlationId: string;

    public constructor(processType: string, taskType: string, taskClass: any, queue: IMessageQueue,
        references: IReferences, parameters: Parameters) {
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

    public get references(): IReferences { return this._references; }
    public get logger(): CompositeLogger { return this._logger; }
    public get counters(): CompositeCounters { return this._counters; }

    public get eventLogClient(): IEventLogClientV1 { return this._eventLogClient; }
    public get settingsClient(): ISettingsClientV1 { return this._settingsClient; }
    public get retriesClient(): IRetriesClientV1 { return this._retriesClient; }

    public setReferences(references: IReferences): void {
        this._references = references;

        this._logger.setReferences(references);
        this.counters.setReferences(references);

        this._eventLogClient = references.getOneOptional<IEventLogClientV1>(new Descriptor('pip-services-eventlog', 'client', '*', '*', '1.0'));
        this._settingsClient = references.getOneOptional<ISettingsClientV1>(new Descriptor('pip-services-settings', 'client', '*', '*', '1.0'));
        this._retriesClient = references.getOneOptional<IRetriesClientV1>(new Descriptor('pip-services-retries', 'client', '*', '*', '1.0'));
    }

    public setParameters(parameters: Parameters): void {
        this.parameters = (this.parameters || new Parameters()).override(parameters);

        this.correlationId = this.parameters.getAsStringWithDefault(ProcessParam.CorrelationId, this.correlationId);
        this.disabled = this.parameters.getAsBooleanWithDefault(ProcessParam.Disabled, this.disabled);
        this.maxNumberOfAttempts = this.parameters.getAsIntegerWithDefault(ProcessParam.MaxNumberOfAttempts, this.maxNumberOfAttempts);

        if (this.disabled && this.queue != null)
            this.queue.endListen(this.correlationId);
    }

    public listen(callback: (err: any) => void): void {
        async.whilst(
            () => !this._cancel,
            (callback) => {
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
                    }], (err) => {
                        callback(err);
                    }
                )
            },
            (err) => {
                if (callback) callback(err);
            }
        );
    }

    public beginListen() {
        this.listen((err) => {
            this._logger.error(null, err, 'Failed while listening for messages');
        });
    }

    private createTask(message: MessageEnvelope, queue: IMessageQueue,
        callback: (err: any, task: Task) => void) {
        var task = this.taskClass() as Task;
        task.initialize(this.processType, this.taskType, message, queue, this.references, this.parameters, (err) => {
            callback(err, task);
        });
    }

    private handlePoisonMessages(message: MessageEnvelope, queue: IMessageQueue, errorMessage: string,
        callback: (err: any) => void): void {
        // Remove junk
        //if (message.message_id == null || (message.message_type == null && message.message == null)) {
        //    queue.moveToDeadLetter(message, callback);
        //    return;
        //}

        if (this._retriesClient == null) {
            if (callback) callback(null);
            return;
        }

        // Record attempt
        let group = this.processType + '.attempt';
        this._retriesClient.addRetry(this.correlationId, group, message.message_id, null, (err, retry) => {
            if (err != null) {
                if (callback) callback(err);
                return;
            }

            // Move to dead letter queue
            if (retry == null) {
                this.queue.moveToDeadLetter(message, callback);
            } else if (retry.attempt_count >= this.maxNumberOfAttempts) {
                queue.moveToDeadLetter(message, (err) => {
                    if (err != null) {
                        if (callback) callback(err);
                        return;
                    }

                    if (this._eventLogClient != null) {
                        // Log warning
                        this._eventLogClient.logEvent(message.correlation_id ?? this.correlationId,
                            <SystemEventV1>{
                                source: this.processType,
                                type: EventLogTypeV1.Failure,
                                correlation_id: message.correlation_id ?? this.correlationId,
                                time: new Date(),
                                severity: EventLogSeverityV1.Informational,
                                message: 'After ' + this.maxNumberOfAttempts + ' attempts moved poison message ' + message + ' to dead queue'
                            }
                        );
                    } else {
                        if (callback) callback(null);
                    }
                });
            }
        });
    }

    public receiveMessage(message: MessageEnvelope, queue: IMessageQueue,
        callback: (err: any) => void) {
        var leaseTimeout = this.parameters.getAsIntegerWithDefault('QueueLeaseTime', 2 * 60 * 1000);
        if (leaseTimeout < 30 * 1000) {
            leaseTimeout = 30 * 1000;
        }

        var task: Task;
        var timing: Timing;

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
                timing = this._counters.beginTiming(this.name + '.exec_time');

                this._counters.incrementOne(this.name + '.call_count');
                this._logger.debug(message.correlation_id ?? this.correlationId, 'Started task %s with %s', this.name, message);

                // Execute the task
                task.execute((err) => {
                    if (!err) {
                        this._logger.debug(message.correlation_id ?? this.correlationId, 'Completed task %s', this.name);
                    }
                    callback(err);
                });
            }
        ], (ex) => {
            let processLockedException = ex as ProcessLockedExceptionV1;

            async.series([
                (callback) => {
                    if (processLockedException) {
                        // Do nothing. Wait and retry
                        callback();
                        return;
                    }

                    // If message wasn't processed the record it as attempt
                    if (message.getReference() != null) {
                        // If process was started but not completed, use recovery
                        if (task.processStage == TaskProcessStage.Processing && task.processState != null) {
                            // For exceeded number of attempts
                            if ((task.processState.recovery_attempts ?? 0) >= this.maxNumberOfAttempts)
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
                this._counters.incrementOne(name + '.attempt_count');
                this._logger.error(message.correlation_id ?? this.correlationId, ex, 'Execution of task {0} failed', name);

                timing.endTiming();
                callback(err);
            });
        });
    }

    public close(correlationId: string, callback: (err: any) => void): void {
        this._cancel = true;
        this.queue.close(correlationId, (err) => {
            this._logger.debug(correlationId, 'Stopped task %s listening at %s', this.name, this.queue.getName());
            if (callback) callback(err);
        });
    }

}
