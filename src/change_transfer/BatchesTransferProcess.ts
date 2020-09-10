import { TransferProcess } from './TransferProcess';
import { IReferences } from 'pip-services3-commons-node';
import { Parameters } from 'pip-services3-commons-node';
import { IMessageQueue } from 'pip-services3-messaging-node';
import { ChangesTransferParam } from './ChangesTransferParam';
import { GeneratorParam } from '../generators/GeneratorParam';
import { BatchesPollGenerator } from '../generators/BatchesPollGenerator';

export class BatchesTransferProcess<T, K> extends TransferProcess<T, K> {
    public constructor(processType: string, references: IReferences, parameters: Parameters) {
        super(processType, references, parameters);

        var transferQueue = this.parameters.getAsObject(ChangesTransferParam.TransferQueue1) as IMessageQueue;
        transferQueue = transferQueue ?? this.parameters.getAsObject(ChangesTransferParam.TransferQueue) as IMessageQueue;

        // Define polling generator
        var pollAdapter = parameters.getAsObject(ChangesTransferParam.PollAdapter);

        this._generator = new BatchesPollGenerator<T, K>(
            this.processType,
            transferQueue, references,
            Parameters.fromTuples(
                GeneratorParam.MessageType, processType + '.Change',
                ChangesTransferParam.PollAdapter, pollAdapter
            ).override(this.parameters)
        );
    }
}