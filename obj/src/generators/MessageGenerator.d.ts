import { IReferenceable, IParameterized, IClosable, IReferences, Parameters } from 'pip-services3-commons-node';
import { IMessageQueue, MessageEnvelope } from 'pip-services3-messaging-node';
import { ILogger, ICounters } from 'pip-services3-components-node';
export declare abstract class MessageGenerator implements IReferenceable, IParameterized, IClosable {
    protected static readonly _defaultParameters: Parameters;
    protected _started: boolean;
    protected _cancel: boolean;
    references: IReferences;
    logger: ILogger;
    counters: ICounters;
    component: string;
    name: string;
    queue: IMessageQueue;
    parameters: Parameters;
    interval: number;
    disabled: boolean;
    messageType: string;
    correlationId: string;
    constructor(component: string, name: string, queue: IMessageQueue, references: IReferences, parameters?: Parameters);
    setReferences(references: IReferences): void;
    setParameters(parameters: Parameters): void;
    sendMessageAsObject(correlationId: string, messageType: string, message: any, callback?: (err: any) => void): void;
    sendMessage(envelop: MessageEnvelope, callback?: (err: any) => void): void;
    abstract execute(callback: (err: any) => void): void;
    beginExecute(callback?: (err: any) => void): void;
    close(correlationId: string, callback?: (err: any) => void): void;
    private delayExecute;
}
