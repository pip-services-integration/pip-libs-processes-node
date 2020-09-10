import { Process } from '../logic/Process';
import { IReferences } from 'pip-services3-commons-node';
import { Parameters } from 'pip-services3-commons-node';
import { BatchSyncParam } from './BatchSyncParam';
import { BatchMultiSyncParam } from './BatchMultiSyncParam';
import { IMessageQueue } from 'pip-services3-messaging-node';
import { BatchSyncName } from './BatchSyncName';
import { BatchSyncDownloadTask } from './BatchSyncDownloadTask';
import { BatchSyncRecoveryTask } from './BatchSyncRecoveryTask';
import { IBatchAllClient } from '../clients/IBatchAllClient';
import { IBatchChangesClient } from '../clients/IBatchChangesClient';
import { BatchSyncUploadTask } from './BatchSyncUploadTask';
import { BatchMultiSyncCloseTask } from './BatchMultiSyncCloseTask';
import { BatchMultiSyncForwardMessageTask } from './BatchMultiSyncForwardMessageTask';

export class BatchMultiSyncProcess<T> extends Process {
    public constructor(processType: string, references?: IReferences, parameters?: Parameters) {
        super(processType, references, parameters);

        if (parameters == null)
            throw new Error('Workflow parameters are not defined');

        // Get required queues
        var startQueue = parameters.get(BatchSyncParam.StartQueue) as IMessageQueue;
        var downloadResponseQueue = parameters.get(BatchSyncParam.DownloadResponseQueue) as IMessageQueue;
        var recoveryStartQueue = parameters.get(BatchSyncParam.RecoveryQueue + 'Start') as IMessageQueue;
        var targetAdapterCount = parameters.getAsInteger(BatchMultiSyncParam.UploadAdapterCount);
        var incremental = parameters.getAsBoolean(BatchSyncParam.IncrementalChanges);

        // Get required services
        var downloadAdapter = parameters.get(BatchSyncParam.DownloadAdapter);

        // Start workflow and load entities
        this.addTask<BatchSyncDownloadTask<T>>(BatchSyncName.DownloadTask, startQueue, 1, Parameters.fromTuples(
            BatchSyncParam.RecoveryQueue, recoveryStartQueue
        ));
        this.addTask<BatchSyncRecoveryTask<T>>(BatchSyncName.RecoveryTask, recoveryStartQueue);

        for (let i = 0; i < targetAdapterCount; i++) {
            var param = new Parameters();
            param.put(BatchMultiSyncParam.UploadAdapterIndex, i);

            var uploadNotifyQueue = parameters.get(BatchMultiSyncParam.UploadNotifyQueue + i) as IMessageQueue;

            var uploadResponseQueue = parameters.get(BatchSyncParam.UploadResponseQueue + i) as IMessageQueue;
            param.put(BatchSyncParam.UploadResponseQueue, uploadResponseQueue);

            var recQueue = parameters.get(BatchSyncParam.RecoveryQueue + i) as IMessageQueue;
            param.put(BatchSyncParam.RecoveryQueue, recQueue);

            if (incremental) {
                let uploadAdapter = parameters.get(BatchSyncParam.UploadAdapter + i) as IBatchChangesClient<T>;
                param.put(BatchSyncParam.UploadAdapter, uploadAdapter);
            }
            else {
                let uploadAdapter = parameters.get(BatchSyncParam.UploadAdapter + i) as IBatchAllClient<T>;
                param.put(BatchSyncParam.UploadAdapter, uploadAdapter);
            }

            this.addTask<BatchSyncUploadTask<T>>(BatchSyncName.UploadTask + i, uploadNotifyQueue, 1, param);
            // Recovery load and save
            this.addTask<BatchSyncRecoveryTask<T>>(BatchSyncName.RecoveryTask + i, recQueue, 1, param);
            // Confirm load and save entities
            this.addTask<BatchMultiSyncCloseTask<T>>(BatchSyncName.CloseTask + i, uploadResponseQueue, 1, param);
        }

        this.addTask<BatchMultiSyncForwardMessageTask>('Queue Transfer', downloadResponseQueue, 1, parameters);
    }
}