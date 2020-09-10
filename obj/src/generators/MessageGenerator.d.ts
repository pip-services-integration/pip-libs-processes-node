import { IReferenceable, IParameterized, IClosable, IReferences, Parameters } from 'pip-services3-commons-node';
import { IMessageQueue } from 'pip-services3-messaging-node';
import { ILogger, ICounters } from 'pip-services3-components-node';
export declare abstract class MessageGenerator implements IReferenceable, IParameterized, IClosable {
    protected static readonly _defaultParameters: Parameters;
    private _started;
    private _cancel;
    References: IReferences;
    Logger: ILogger;
    Counters: ICounters;
    Component: string;
    Name: string;
    Queue: IMessageQueue;
    Parameters: Parameters;
    Interval: number;
    Disabled: boolean;
    MessageType: string;
    CorrelationId: string;
    constructor(component: string, name: string, queue: IMessageQueue, references: IReferences, parameters?: Parameters);
    setReferences(references: IReferences): void;
    setParameters(parameters: Parameters): void;
    abstract execute(callback: (err: any) => void): void;
    beginExecute(callback?: (err: any) => void): void;
    close(correlationId: string, callback?: (err: any) => void): void;
    private delayExecute;
}
