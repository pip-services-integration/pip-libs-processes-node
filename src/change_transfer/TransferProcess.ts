import { Process, ProcessParam } from "../logic";
import { Parameters, IReferences } from "pip-services3-commons-node";
import { ChangesTransferParam } from "./ChangesTransferParam";
import { MessageGenerator } from "../generators/MessageGenerator";
import { ChangePostTask } from "./ChangePostTask";
import { IMessageQueue } from "pip-services3-messaging-node";

export class TransferProcess<T, K> extends Process {

    protected _generator: MessageGenerator;

    protected static readonly _defaultParameters: Parameters = Parameters.fromTuples(
        ChangesTransferParam.SendToUpdateAsyncOnly, false
    );

    public constructor(processType: string, references: IReferences, parameters: Parameters) {
        super(processType, references, parameters);

        // Define post tasks
        var postAdapter = this.parameters.getAsObject(ChangesTransferParam.PostAdapter1);
        postAdapter = postAdapter ?? this.parameters.getAsObject(ChangesTransferParam.PostAdapter);

        var transferQueue = this.parameters.getAsObject(ChangesTransferParam.TransferQueue1) as IMessageQueue;
        transferQueue = transferQueue ?? this.parameters.getAsObject(ChangesTransferParam.TransferQueue) as IMessageQueue;

        this.addTask<ChangePostTask<T, K>>(
            "Post", ChangePostTask, transferQueue, -1,
            Parameters.fromTuples(
                ProcessParam.IsInitial, true,
                ProcessParam.IsFinal, true,
                ChangesTransferParam.PostAdapter, postAdapter
            )
        );
    }

    public setParameters(parameters: Parameters) {
        super.setParameters(parameters);

        // Update generator 
        if (this._generator != null)
            this._generator.setParameters(parameters);
    }

    public beginListen() {
        super.beginListen();
        this._generator.beginExecute();
    }

    public close(correlationId: string, callback: (err: any) => void) {
        this._generator.close(correlationId, (err) => {
            super.close(correlationId, callback);
        });
    }
}