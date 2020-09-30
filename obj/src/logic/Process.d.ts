import { IReferenceable, Parameters, IReferences } from 'pip-services3-commons-node';
import { IParameterized } from 'pip-services3-commons-node';
import { IClosable } from 'pip-services3-commons-node';
import { ITaskHandler } from './ITaskHandler';
import { CompositeLogger } from 'pip-services3-components-node';
import { IMessageQueue } from 'pip-services3-messaging-node';
import { Task } from './Task';
export declare class Process implements IReferenceable, IParameterized, IClosable {
    protected static readonly _defaultParameters: Parameters;
    private _handlers;
    protected _references: IReferences;
    protected _logger: CompositeLogger;
    processType: string;
    parameters: Parameters;
    numberOfListeners: number;
    simulationInterval: number;
    disabled: boolean;
    correlationId: string;
    constructor(processType: string, references?: IReferences, parameters?: Parameters);
    setReferences(references: IReferences): void;
    setParameters(parameters: Parameters): void;
    close(correlationId: string, callback?: (err: any) => void): void;
    addTask<T extends Task>(taskType: string, taskClass: (new () => T), queue: IMessageQueue, numberOfListeners?: number, parameters?: Parameters): Process;
    beginListen(): void;
    addTaskHandler(taskHandler: ITaskHandler): Process;
}
