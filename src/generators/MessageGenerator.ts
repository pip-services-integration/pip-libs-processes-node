let async = require('async');

import { IReferenceable, IParameterized, IClosable, IReferences, Parameters } from 'pip-services3-commons-node';
import { GeneratorParam } from './GeneratorParam';
import { IMessageQueue, MessageEnvelope } from 'pip-services3-messaging-node';
import { ILogger, ICounters, CompositeLogger, CompositeCounters } from 'pip-services3-components-node';
import { setImmediate } from 'timers';

export abstract class MessageGenerator implements IReferenceable, IParameterized, IClosable {
    protected static readonly _defaultParameters: Parameters = Parameters.fromTuples(
        GeneratorParam.Interval, 5 * 60 * 1000
    );

    protected _started: boolean = false;
    protected _cancel: boolean = false;

    public references: IReferences;
    public logger: ILogger;
    public counters: ICounters;

    public component: string;
    public name: string;
    public queue: IMessageQueue;

    public parameters: Parameters;
    public interval: number;
    public disabled: boolean;
    public messageType: string;
    public correlationId: string;

    public constructor(component: string, name: string, queue: IMessageQueue, references: IReferences, parameters: Parameters = null) {
        if (component == null)
            throw new Error('Component cannot be null');
        if (queue == null)
            throw new Error('Queue cannot be null');
        if (references == null)
            throw new Error('References cannot be null');

        this.component = component;
        this.name = name ?? typeof this;
        this.queue = queue;

        this.setParameters(MessageGenerator._defaultParameters.override(parameters));
        if (references != null) this.setReferences(references);
    }

    setReferences(references: IReferences): void {
        this.references = references;

        this.logger = new CompositeLogger(references);
        this.counters = new CompositeCounters();
    }

    setParameters(parameters: Parameters): void {
        this.parameters = (this.parameters ?? new Parameters()).override(parameters);

        this.interval = this.parameters.getAsIntegerWithDefault(GeneratorParam.Interval, this.interval);
        this.messageType = this.parameters.getAsStringWithDefault(GeneratorParam.MessageType, this.messageType);
        this.disabled = this.parameters.getAsBooleanWithDefault(GeneratorParam.Disabled, this.disabled);
        this.correlationId = this.parameters.getAsStringWithDefault(GeneratorParam.CorrelationId, this.correlationId);
    }

    public sendMessageAsObject(correlationId: string, messageType: string, message: any, callback?: (err: any) => void) {
        var envelope = new MessageEnvelope(correlationId ?? this.correlationId, messageType, message);
        this.sendMessage(envelope, callback);
    }

    public sendMessage(envelop: MessageEnvelope, callback?: (err: any) => void) {
        // Redefine message type based on the configuration
        envelop.message_type = envelop.message_type ?? this.messageType;

        this.queue.send(this.correlationId, envelop, (err) => {
            if (err) {
                if (callback) callback(err);
                return;
            }

            this.logger.trace(this.correlationId, "%s.%s sent message to %s", this.component, this.name, this.queue);
            if (callback) callback(null);
        });
    }

    public abstract execute(callback: (err: any) => void): void;

    public beginExecute(callback?: (err: any) => void): void {
        // If already started then exit
        if (this._started) return;

        this._started = true;

        async.whilst(
            () => !this._cancel,
            (callback) => {
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
                    }], (err) => {
                        if (!err) setImmediate(callback);
                        else callback(err);
                        // callback(err);
                    }
                )
            },
            (err) => {
                this._started = false;
                if (callback) callback(err);
            }
        );
    }

    close(correlationId: string, callback?: (err: any) => void): void {
        // Cancel the processing
        this._cancel = true;

        // Close output queue
        this.queue.close(correlationId, callback);
    }

    private delayExecute(callback?: (err: any) => void) {
        if (this.interval == Number.MAX_SAFE_INTEGER)   // Infinite
        {
            async.whilst(
                () => this.interval == Number.MAX_SAFE_INTEGER || !this._cancel,
                (callback) => {
                    setTimeout(() => {
                        callback();
                    }, 5 * 60 * 1000); // 5 min
                },
                (err) => {
                    callback(err);
                }
            );
        }
        else {
            let interval = this.interval;
            let timeout = 10 * 1000; // 10 sec

            async.whilst(
                () => interval > 0 || !this._cancel,
                (callback) => {
                    setTimeout(() => {
                        interval -= timeout;
                        callback();
                    }, timeout);
                },
                (err) => {
                    callback(err);
                }
            );
        }
    }
}