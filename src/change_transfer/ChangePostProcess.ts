import { Process, ProcessParam } from '../logic';
import { IReferences } from 'pip-services3-commons-node';
import { Parameters } from 'pip-services3-commons-node';
import { ChangesTransferParam } from './ChangesTransferParam';
import { IMessageQueue } from 'pip-services3-messaging-node';
import { ChangePostTask } from './ChangePostTask';

export class ChangePostProcess<T, K> extends Process {
    public constructor(processType: string, references: IReferences, parameters: Parameters) {
        super(processType, references, parameters);

        // Define post activities
        var postAdapter = parameters.get(ChangesTransferParam.PostAdapter1);
        postAdapter = postAdapter ?? parameters.get(ChangesTransferParam.PostAdapter);

        var transferQueue = parameters.getAsObject(ChangesTransferParam.TransferQueue1) as IMessageQueue;
        transferQueue = transferQueue ?? parameters.getAsObject(ChangesTransferParam.TransferQueue) as IMessageQueue;

        var postponeTimeout = parameters.get(ChangesTransferParam.PostponeTimeout);

        this.addTask<ChangePostTask<T, K>>(
            'Post', ChangePostTask, transferQueue, -1,
            Parameters.fromTuples(
                ProcessParam.IsInitial, 'true',
                ProcessParam.IsFinal, 'true',
                ChangesTransferParam.PostAdapter, postAdapter,
                ChangesTransferParam.PostponeTimeout, postponeTimeout
            )
        );
    }
}