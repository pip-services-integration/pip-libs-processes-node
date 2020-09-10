let async = require('async');

import { Process } from '../logic/Process';
import { IReadWriteClient } from '../clients/IReadWriteClient';
import { MessageGenerator } from '../generators/MessageGenerator';
import { IMessageQueue } from 'pip-services3-messaging-node';
import { IReferences } from 'pip-services3-commons-node';
import { Parameters } from 'pip-services3-commons-node';
import { ChangesTransferParam } from './ChangesTransferParam';
import { ProcessParam } from '../logic/ProcessParam';
import { ChangePostTask } from './ChangePostTask';

export class SequenceTransferProcess<T, K> extends Process {
    protected _pollAdapter: IReadWriteClient<T, K>;
    protected _generator: MessageGenerator;

    protected _postAdapters: IReadWriteClient<T, K>[] = [];
    protected _transferQueues: IMessageQueue[] = [];

    public constructor(processType: string, references?: IReferences, parameters?: Parameters) {
        super(processType, references, parameters);

        if (parameters == null)
            throw new Error('Process parameters are not defined');

        this.defineSource();
        this.defineDestinations();
        this.createTasks();
    }

    public setParameters(parameters: Parameters) {
        super.setParameters(parameters);

        // Update generator parameters
        if (this._generator != null)
            this._generator.setParameters(parameters);
    }


    private defineSource() {
        this._pollAdapter = this.parameters.get(ChangesTransferParam.PollAdapter) as IReadWriteClient<T, K>;

        // BEaton: my guess is that _pollAdapter is defined here so the two current subclasses can use it directly.
        //  But some SequenceTransfer workflows transfer from a queue directly, and don't need a poll adapter. So
        //  don't choke if it doesn't exist (those that need it, will need to define it, and those that don't, won't)
        // if (_pollAdapter == null)
        //     throw new ArgumentException('PollAdapter is not defined or doesn't implement IReadWrite client interface');
    }

    private defineDestinations() {
        // Clean up previous settings
        this._postAdapters = [];
        this._transferQueues = [];

        // Define adapter and queue for the 1st system
        var postAdapter = this.parameters.getAsObject(ChangesTransferParam.PostAdapter) as IReadWriteClient<T, K>;
        postAdapter = postAdapter ?? this.parameters.getAsObject(ChangesTransferParam.PostAdapter1) as IReadWriteClient<T, K>;
        if (postAdapter == null)
            throw new Error('PostAdapter1 is not defined or doesn\'t implement IReadWriteClient interface');

        var transferQueue = this.parameters.getAsObject(ChangesTransferParam.TransferQueue1) as IMessageQueue;
        transferQueue = transferQueue ?? this.parameters.getAsObject(ChangesTransferParam.TransferQueue) as IMessageQueue;
        if (transferQueue == null)
            throw new Error('TransferQueue1 is not defined');

        this._postAdapters.push(postAdapter);
        this._transferQueues.push(transferQueue);

        // Define adapter and queue for the 2nd system
        postAdapter = this.parameters.getAsObject(ChangesTransferParam.PostAdapter2) as IReadWriteClient<T, K>;
        transferQueue = this.parameters.getAsObject(ChangesTransferParam.TransferQueue2) as IMessageQueue;

        if (postAdapter == null && transferQueue != null)
            throw new Error('PostAdapter2 is not defined');
        else if (postAdapter != null && transferQueue == null)
            throw new Error('TransferQueue2 is not defined');
        else if (postAdapter != null && transferQueue != null) {
            this._postAdapters.push(postAdapter);
            this._transferQueues.push(transferQueue);
        }

        // Define adapter and queue for the 3rd system
        postAdapter = this.parameters.getAsObject(ChangesTransferParam.PostAdapter3) as IReadWriteClient<T, K>;
        transferQueue = this.parameters.getAsObject(ChangesTransferParam.TransferQueue3) as IMessageQueue;

        if (postAdapter == null && transferQueue != null)
            throw new Error('PostAdapter3 is not defined');
        else if (postAdapter != null && transferQueue == null)
            throw new Error('TransferQueue3 is not defined');
        else if (postAdapter != null && transferQueue != null) {
            if (this._postAdapters.length < 2)
                throw new Error('PostAdapter2 and TransferQueue2 are not defined');

            this._postAdapters.push(postAdapter);
            this._transferQueues.push(transferQueue);
        }
    }

    private createTasks() {
        for (var index = 0; index < this._transferQueues.length; index++) {
            var initial = index == 0;
            var final = index == this._transferQueues.length - 1;

            var parameters = Parameters.fromTuples(
                ProcessParam.IsInitial, initial,
                ProcessParam.IsFinal, final,
                ChangesTransferParam.ProcessKeyPrefix, '',
                ChangesTransferParam.PostAdapter, this._postAdapters[index],
                ChangesTransferParam.TransferQueue, !final ? this._transferQueues[index + 1] : null
            );

            this.addTask<ChangePostTask<T, K>>(
                'Post' + (index + 1),
                this._transferQueues[index],
                -1,
                parameters
            );
        }
    }

    public beginListen(): void {
        super.beginListen();
        if (this._generator != null)
            this._generator.beginExecute();
    }

    public close(correlationId: string, callback?: (err: any) => void): void {
        async.series([
            (callback) => {
                if (this._generator != null) {
                    this._generator.close(correlationId, callback);
                    return;
                }

                callback();
            },
            (callback) => {
                super.close(correlationId, callback);
            }
        ], callback);
    }
}