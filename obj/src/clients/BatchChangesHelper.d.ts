import { IBatchAllClient } from "./IBatchAllClient";
import { IReferenceable, IParameterized, IReferences, FilterParams } from "pip-services3-commons-node";
import { IBatchChangesClient } from "./IBatchChangesClient";
import { Parameters } from "pip-services3-commons-node";
import { Timing } from "pip-services3-components-node";
import { IReadWriteClient } from "./IReadWriteClient";
export declare class BatchChangesHelper<T, K> implements IBatchChangesClient<T>, IBatchAllClient<T>, IReferenceable, IParameterized {
    private static readonly _defaultParameters;
    private _references;
    private _logger;
    private _counters;
    private _tempBlob;
    adapter: string;
    service: string;
    client: IReadWriteClient<T, K>;
    pageSize: number;
    entitiesPerBlob: number;
    blobTimeToLive?: number;
    correlationId: string;
    downloadChangesMessageType: string;
    uploadChangesMessageType: string;
    constructor(adapter: string, service: string, client: IReadWriteClient<T, K>, references?: IReferences, parameters?: Parameters);
    setReferences(references: IReferences): void;
    setParameters(parameters: Parameters): void;
    protected instrument(correlationId: string, methodName: string, message?: string): Timing;
    protected handleError(correlationId: string, methodName: string, error: any): any;
    downloadAll(correlationId: string, responseQueueName: string, requestId: string, callback: (err: any) => void): void;
    uploadAll(correlationId: string, blobIds: string[], responseQueueName: string, requestId: string, callback: (err: any) => void): void;
    private isChangeable;
    private isIdentifiable;
    downloadChanges(correlationId: string, filter: FilterParams, fromTime: Date, toTime: Date, responseQueueName: string, requestId: string, callback: (err: any) => void): void;
    private writeChunkToBlob;
    uploadChanges(correlationId: string, blobIds: string[], responseQueueName: string, requestId: string, callback: (err: any) => void): void;
    private sendConfirm;
}
