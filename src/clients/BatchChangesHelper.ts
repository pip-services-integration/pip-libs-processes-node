import { IBatchAllClient } from "./IBatchAllClient";
import { IReferenceable, IParameterized, IReferences } from "pip-services3-commons-node";
import { IBatchChangesClient } from "./IBatchChangesClient";
import { ClientParam } from "./ClientParam";
import { Parameters } from "pip-services3-commons-node";
import { CompositeLogger, CompositeCounters, Timing } from "pip-services3-components-node";

import { ApplicationException } from "pip-services3-commons-node"
import { IReadWriteClient } from "./IReadWriteClient";

export class BatchChangesHelper<T, K> implements IBatchChangesClient<T>, IBatchAllClient<T>, IReferenceable, IParameterized {

    private static readonly _defaultParameters: Parameters = Parameters.fromTuples(
        ClientParam.PageSize, 100,
        ClientParam.EntitiesPerBlob, 100,
        ClientParam.BlobTimeToLive, 24 * 60 * 60 * 1000, // 1 day
        ClientParam.DownloadChangesMessageType, "DownloadChangesResponse",
        ClientParam.UploadChangesMessageType, "UploadChnagesResponse"
    );

    private _references: IReferences;
    private _logger: CompositeLogger = new CompositeLogger();
    private _counters: CompositeCounters = new CompositeCounters();
    private _tempBlob: ITempBlobClient = null;

    public adapter: string;// { get; private set; }
    public service: string;//{ get; private set; }

    public client: IReadWriteClient<T, K> //{ get; private set; }

    public pageSize: number;
    public entitiesPerBlob: number;
    public blobTimeToLive?: number;
    public correlationId: string;

    public downloadChangesMessageType: string;
    public uploadChangesMessageType: string;


    public constructor(adapter: string, service: string, client: IReadWriteClient<T, K>,
        references?: IReferences, parameters?: Parameters) {
        if (adapter == null)
            throw new ApplicationException("Adapter cannot be null");
        if (service == null)
            throw new ApplicationException("Service cannot be null");
        if (client == null)
            throw new ApplicationException("Client cannot be null");

        this.adapter = adapter;
        this.service = service;
        this.client = client;

        this.setParameters(BatchChangesHelper._defaultParameters.override(parameters));
        if (references != null) this.setReferences(references);
    }


    public setReferences(references: IReferences) {
        this._references = references;

        this._logger.setReferences(references);
        this._counters.setReferences(references);

        this._tempBlob = references.getOneOptional<ITempBlobClient>(KnownDescriptor.TempBlob);
    }

    public setParameters(parameters: Parameters) {
        this.pageSize = parameters.getAsIntegerWithDefault(ClientParam.PageSize, this.pageSize);
        this.entitiesPerBlob = parameters.getAsIntegerWithDefault(ClientParam.EntitiesPerBlob, this.entitiesPerBlob);
        this.blobTimeToLive = parameters.getAsLongWithDefault(ClientParam.BlobTimeToLive, this.blobTimeToLive);
        this.correlationId = parameters.getAsStringWithDefault(ClientParam.CorrelationId, this.correlationId);

        this.downloadChangesMessageType = parameters.getAsStringWithDefault(
            ClientParam.DownloadChangesMessageType, this.downloadChangesMessageType);
        this.uploadChangesMessageType = parameters.getAsStringWithDefault(
            ClientParam.UploadChangesMessageType, this.uploadChangesMessageType);
    }

    protected instrument(correlationId: string, methodName: string, message: string = ""): Timing {
        this._logger.trace(correlationId ?? this.correlationId, "Called {0}.{1}.{2} {3}", this.adapter, this.service, methodName, message);
        return this._counters.beginTiming(this.adapter + "." + this.service + "." + methodName + ".call_time");
    }

    protected handleError(correlationId: string, methodName: string, error: any): any {
        this._logger.error(correlationId ?? this.correlationId, error, "Failed to call {0}.{1}.{2}", this.adapter, this.service, methodName);
        return error;
    }

    // private beginExecute( action:Action) {
        // ThreadPool.QueueUserWorkItem(delegate
        //         {
        //         try
        //             {
        //             // Perform action
        //             action();
        //         }
        //             catch(Exception ex) {
        //             // Ignore errors...
        //             _logger.Error(CorrelationId, ex, "Error while asynchronous execution");
        //         }
        //     });
    // }

    
}