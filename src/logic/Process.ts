let async = require('async');

import { IReferenceable, Parameters, IReferences } from 'pip-services3-commons-node';
import { IParameterized } from 'pip-services3-commons-node';
import { IClosable } from 'pip-services3-commons-node';
import { ProcessParam } from './ProcessParam';
import { ITaskHandler } from './ITaskHandler';
import { CompositeLogger } from 'pip-services3-components-node';
import { TaskHandler } from './TaskHandler';
import { IMessageQueue } from 'pip-services3-messaging-node';
import { Task } from './Task';

export class Process implements IReferenceable, IParameterized, IClosable {
    protected static readonly _defaultParameters: Parameters = Parameters.fromTuples(
        ProcessParam.NumberOfListeners, 5,
        ProcessParam.RecoveryTimeout, 5 * 60 * 1000, // 5 min
        ProcessParam.ProcessTimeToLive, 7 * 24 * 60 * 1000, // 7 days
        ProcessParam.SimulationInterval, Number.MAX_SAFE_INTEGER // Timeout.InfiniteTimeSpan
    );

    private _handlers: ITaskHandler[] = [];
    //private _parameterizer: ComponentParameterizer; ?

    protected _references: IReferences;
    protected _logger: CompositeLogger;

    public processType: string;
    public parameters: Parameters;
    public numberOfListeners: number;
    public simulationInterval: number;
    public disabled: boolean;
    public correlationId: string;

    public constructor(processType: string, references: IReferences = null, parameters: Parameters = null) {
        if (processType == null)
            throw new Error('Process type cannot be null');

        this.processType = processType;

        this.setParameters(Process._defaultParameters.override(parameters));
        if (references != null) this.setReferences(references);
    }

    setReferences(references: IReferences): void {
        this._references = references;
        this._logger = new CompositeLogger(references);
        // _parameterizer = new ComponentParameterizer(ProcessType, this, references);
    }

    setParameters(parameters: Parameters): void {
        this.parameters = (this.parameters ?? new Parameters()).override(parameters);

        this.numberOfListeners = this.parameters.getAsIntegerWithDefault(ProcessParam.NumberOfListeners, this.numberOfListeners);
        this.disabled = this.parameters.getAsBooleanWithDefault(ProcessParam.Disabled, this.disabled);
        this.simulationInterval = this.parameters.getAsIntegerWithDefault(ProcessParam.SimulationInterval, this.simulationInterval);
        if (this.simulationInterval == 0) {
            this.simulationInterval = Number.MAX_SAFE_INTEGER;
        }
        this.correlationId = this.parameters.getAsStringWithDefault(ProcessParam.CorrelationId, this.correlationId);

        // Reconfigure handlers
        this._handlers.forEach((handler) => handler.setParameters(this.parameters));
    }

    close(correlationId: string, callback?: (err: any) => void): void {
        async.each(this._handlers, (handler: ITaskHandler, callback: (err: any) => void) => {
            handler.close(correlationId, callback);
        }, (err: any) => {
            if (callback) callback(err);
        })
    }

    public addTask<T extends Task>(taskType: string, taskClass: (new () => T), queue: IMessageQueue,
        numberOfListeners: number = 0, parameters: Parameters = null): Process {
        if (taskType == null)
            throw new Error('Task type cannot be null');
        if (queue == null)
            throw new Error('Message queue cannot be null');

        parameters = this.parameters.override(parameters);
        numberOfListeners = numberOfListeners > 0 ? numberOfListeners : this.numberOfListeners;
        for (var index = 0; index < numberOfListeners; index++) {
            this.addTaskHandler(new TaskHandler(this.processType, taskType, taskClass, queue, this._references, parameters));
        }

        return this;
    }

    public beginListen(): void {
        if (this._handlers.length == 0)
            this._logger.warn(this.correlationId, 'Process %s has no tasks defined', this.processType);

        this._handlers.forEach((handler) => handler.beginListen());
    }

    public addTaskHandler(taskHandler: ITaskHandler): Process {
        this._handlers.push(taskHandler);
        return this;
    }
}