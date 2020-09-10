import { IReferences } from 'pip-services3-commons-node';
import { Parameters } from 'pip-services3-commons-node';
import { ChangesPollGenerator } from '../generators/ChangesPollGenerator';
import { GeneratorParam } from '../generators/GeneratorParam';
import { ChangesTransferParam } from './ChangesTransferParam';
import { TransferProcess } from './TransferProcess';
import { IMessageQueue } from 'pip-services3-messaging-node';

export class ChangesTransferProcess<T, K> extends TransferProcess<T, K> {
    public constructor(processType: string, references: IReferences, parameters: Parameters) {
        super(processType, references, parameters);

        var transferQueue = this.parameters.getAsObject(ChangesTransferParam.TransferQueue1) as IMessageQueue;
        transferQueue = transferQueue ?? this.parameters.getAsObject(ChangesTransferParam.TransferQueue) as IMessageQueue;

        // Define polling generator
        var pollAdapter = this.parameters.getAsObject(ChangesTransferParam.PollAdapter);

        this._generator = new ChangesPollGenerator<T, K>(
            this.processType,
            transferQueue, references,
            Parameters.fromTuples(
                GeneratorParam.MessageType, processType + '.Change',
                ChangesTransferParam.PollAdapter, pollAdapter
            ).override(this.parameters)
        );
    }
}