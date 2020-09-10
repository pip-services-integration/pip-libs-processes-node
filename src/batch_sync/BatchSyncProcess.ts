import { Process } from '../logic/Process';
import { Parameters, IReferences } from 'pip-services3-commons-node';
import { BatchSyncParam } from './BatchSyncParam';
import { IMessageQueue } from 'pip-services3-messaging-node';
import { BatchSyncName } from './BatchSyncName';
import { BatchSyncDownloadTask } from './BatchSyncDownloadTask';
import { BatchSyncUploadTask } from './BatchSyncUploadTask';
import { BatchSyncCloseTask } from './BatchSyncCloseTask';
import { BatchSyncRecoveryTask } from './BatchSyncRecoveryTask';

export class BatchSyncProcess<T> extends Process {
    public constructor(processType: string, references?: IReferences, parameters?: Parameters) {
        super(processType, references, parameters);

        if (parameters == null)
            throw new Error('Process parameters are not defined');

        // Get required queues
        var startQueue = parameters.getAsObject(BatchSyncParam.StartQueue) as IMessageQueue;
        var downloadResponseQueue = parameters.getAsObject(BatchSyncParam.DownloadResponseQueue) as IMessageQueue;
        var uploadResponseQueue = parameters.getAsObject(BatchSyncParam.UploadResponseQueue) as IMessageQueue;
        var recoveryQueue = parameters.getAsObject(BatchSyncParam.RecoveryQueue) as IMessageQueue;

        // Get required services
        var downloadAdapter = parameters.getAsObject(BatchSyncParam.DownloadAdapter);
        var uploadAdapter = parameters.getAsObject(BatchSyncParam.UploadAdapter);

        // Start process and load entities
        this.addTask<BatchSyncDownloadTask<T>>(BatchSyncName.DownloadTask, startQueue);

        // Confirm load and save entities
        this.addTask<BatchSyncUploadTask<T>>(BatchSyncName.UploadTask, downloadResponseQueue);

        // Confirm save and close process
        this.addTask<BatchSyncCloseTask<T>>(BatchSyncName.CloseTask, uploadResponseQueue);

        // Recovery load and save
        this.addTask<BatchSyncRecoveryTask<T>>(BatchSyncName.RecoveryTask, recoveryQueue);
    }
}