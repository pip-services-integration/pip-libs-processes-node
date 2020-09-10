let async = require('async');

import { IReferenceable, IParameterized, IClosable, IReferences, Parameters } from 'pip-services3-commons-node';
import { GeneratorParam } from './GeneratorParam';
import { IMessageQueue } from 'pip-services3-messaging-node';
import { ILogger, ICounters, CompositeLogger, CompositeCounters } from 'pip-services3-components-node';

export abstract class MessageGenerator implements IReferenceable, IParameterized, IClosable {
    protected static readonly _defaultParameters: Parameters = Parameters.fromTuples(
        GeneratorParam.Interval, 5 * 60 * 1000
    );

    private _started: boolean = false;
    private _cancel: boolean = false;

    public References: IReferences;
    public Logger: ILogger;
    public Counters: ICounters;

    public Component: string;
    public Name: string;
    public Queue: IMessageQueue;

    public Parameters: Parameters;
    public Interval: number;
    public Disabled: boolean;
    public MessageType: string;
    public CorrelationId: string;

    public constructor(component: string, name: string, queue: IMessageQueue, references: IReferences, parameters: Parameters = null) {
        if (component == null)
            throw new Error('Component cannot be null');
        if (queue == null)
            throw new Error('Queue cannot be null');
        if (references == null)
            throw new Error('References cannot be null');

        this.Component = component;
        this.Name = name ?? typeof this;
        this.Queue = queue;

        this.setParameters(MessageGenerator._defaultParameters.override(parameters));
        if (references != null) this.setReferences(references);
    }

    setReferences(references: IReferences): void {
        this.References = references;

        this.Logger = new CompositeLogger(references);
        this.Counters = new CompositeCounters();
    }

    setParameters(parameters: Parameters): void {
        this.Parameters = (this.Parameters ?? new Parameters()).override(parameters);

        this.Interval = this.Parameters.getAsIntegerWithDefault(GeneratorParam.Interval, this.Interval);
        this.MessageType = this.Parameters.getAsStringWithDefault(GeneratorParam.MessageType, this.MessageType);
        this.Disabled = this.Parameters.getAsBooleanWithDefault(GeneratorParam.Disabled, this.Disabled);
        this.CorrelationId = this.Parameters.getAsStringWithDefault(GeneratorParam.CorrelationId, this.CorrelationId);
    }

    public abstract execute(callback: (err: any) => void): void;

    public beginExecute(callback?: (err: any) => void): void {
        // If already started then exit
        if (this._started) return;

        async.whilst(
            () => !this._cancel,
            (callback) => {
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
                    }], (err) => {
                        callback(err);
                    }
                )
            },
            (err) => {
                this._started = true;
                if (callback) callback(err);
            }
        );
    }

    close(correlationId: string, callback?: (err: any) => void): void {
        // Cancel the processing
        this._cancel = true;

        // Close output queue
        this.Queue.close(correlationId, callback);
    }

    private delayExecute(callback?: (err: any) => void) {
        if (this.Interval == Number.MAX_SAFE_INTEGER)   // Infinite
        {
            async.whilst(
                () => this.Interval == Number.MAX_SAFE_INTEGER || !this._cancel,
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
            let interval = this.Interval;
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