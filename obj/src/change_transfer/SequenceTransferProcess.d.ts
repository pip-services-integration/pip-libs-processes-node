import { Process } from '../logic/Process';
import { IReadWriteClient } from '../clients/IReadWriteClient';
import { MessageGenerator } from '../generators/MessageGenerator';
import { IMessageQueue } from 'pip-services3-messaging-node';
import { IReferences } from 'pip-services3-commons-node';
import { Parameters } from 'pip-services3-commons-node';
export declare class SequenceTransferProcess<T, K> extends Process {
    protected _pollAdapter: IReadWriteClient<T, K>;
    protected _generator: MessageGenerator;
    protected _postAdapters: IReadWriteClient<T, K>[];
    protected _transferQueues: IMessageQueue[];
    constructor(processType: string, references?: IReferences, parameters?: Parameters);
    setParameters(parameters: Parameters): void;
    private defineSource;
    private defineDestinations;
    private createTasks;
    beginListen(): void;
    close(correlationId: string, callback?: (err: any) => void): void;
}
