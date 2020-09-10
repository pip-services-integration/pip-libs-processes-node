import { ChangesPollGenerator } from './ChangesPollGenerator';
import { Parameters, IReferences } from 'pip-services3-commons-node';
import { IMessageQueue } from 'pip-services3-messaging-node';
export declare class BatchesPollGenerator<T, K> extends ChangesPollGenerator<T, K> {
    protected static readonly _defaultParameters: Parameters;
    BatchesPerRequest: number;
    constructor(component: string, queue: IMessageQueue, references: IReferences, parameters?: Parameters);
    setParameters(parameters: Parameters): void;
    execute(callback: (err: any) => void): void;
}
