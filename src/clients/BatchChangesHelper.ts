let async = require('async');

import { IBatchAllClient } from "./IBatchAllClient";
import { IReferenceable, IParameterized, IReferences, Descriptor, FilterParams, StringConverter, PagingParams, IIdentifiable, TypeConverter, TypeCode } from "pip-services3-commons-node";
import { IBatchChangesClient } from "./IBatchChangesClient";
import { ClientParam } from "./ClientParam";
import { Parameters } from "pip-services3-commons-node";
import { CompositeLogger, CompositeCounters, Timing } from "pip-services3-components-node";

import { ApplicationException } from "pip-services3-commons-node"
import { IReadWriteClient } from "./IReadWriteClient";
import { ITempBlobsClientV1 } from 'pip-clients-tempblobs-node';
import { DataChange } from "../data/DataChange";
import { ChangeType } from "../data/ChangeType";
import { IChangeable, RequestConfirmation } from "../data";
import { IMessageQueue } from "pip-services3-messaging-node";
import { KnownDescriptors } from "../logic";

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
    private _tempBlob: ITempBlobsClientV1 = null;

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

        this._tempBlob = references.getOneOptional<ITempBlobsClientV1>(KnownDescriptors.TempBlobs);
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

    public downloadAll(correlationId: string, responseQueueName: string, requestId: string, callback: (err: any) => void): void {
        this.downloadChanges(correlationId, null, null, null, responseQueueName, requestId, callback);
    }

    public uploadAll(correlationId: string, blobIds: string[], responseQueueName: string, requestId: string, callback: (err: any) => void): void {
        this.uploadChanges(correlationId, blobIds, responseQueueName, requestId, callback);
    }

    private isChangeable(obj: any): obj is IChangeable {
        let changeable = obj as IChangeable;
        return changeable.deleted !== undefined;
    }

    private isIdentifiable<K>(obj: any): obj is IIdentifiable<K> {
        let identifiable = obj as IIdentifiable<K>;
        return identifiable.id !== undefined;
    }

    public downloadChanges(correlationId: string, filter: FilterParams, fromTime: Date, toTime: Date, responseQueueName: string, requestId: string,
        callback: (err: any) => void): void {

        filter = filter ?? new FilterParams();

        var timing = this.instrument(correlationId, "downloadChanges", "with filter " + filter.toString() +
            " from " + StringConverter.toString(fromTime) + " to " + responseQueueName);

        var blobIds: string[] = [];
        var chunk: T[] = [];
        var skip = 0;

        async.whilst(
            () => chunk.length < this.pageSize || chunk.length == 0,
            (callback) => {
                // Get a chunk
                var paging = new PagingParams(skip, this.entitiesPerBlob, false);
                this.client.getByFilter(correlationId, filter, paging, (err, page) => {
                    if (err) {
                        callback(err);
                        return;
                    }

                    chunk = page.data ?? [];
                    skip += chunk.length;

                    var changes: DataChange<T>[] = [];
                    var now = new Date(Date.now());

                    var i = 0;
                    async.whilst(
                        () => i < chunk.length,
                        (callback) => {
                            let entity = chunk[i];

                            let changeType = ChangeType.Updated;
                            let changeTime = now;
                            let id: string = null;

                            if (this.isChangeable(entity)) {
                                if (entity.deleted)
                                    changeType = ChangeType.Deleted;

                                if (entity.create_time == entity.change_time)
                                    changeType = ChangeType.Created;

                                changeTime = entity.change_time;
                            }

                            // Clarify entity id
                            if (this.isIdentifiable<K>(entity)) {
                                let identifiable = entity as IIdentifiable<K>;
                                id = identifiable.id.toString();
                            }

                            let change: DataChange<T> =
                            {
                                change_time: changeTime,
                                data: entity,
                                id: id,
                                change_type: changeType
                            };

                            changes.push(change);
                            i++;

                            callback();
                        },
                        (err) => {
                            if (err) {
                                callback(err);
                                return;
                            }

                            this._tempBlob.writeBlobAsObject(correlationId, changes, this.blobTimeToLive, (err, blobId) => {
                                if (err) {
                                    callback(err);
                                    return;
                                }

                                blobIds.push(blobId);
                                this._logger.trace(correlationId, "Downloaded {0} {1} into blob {2}", chunk.length, this.service, blobId);
                                callback();
                            });
                        }
                    );
                });
            },
            (err) => {
                if (err) {
                    this._logger.error(correlationId, err, "Failed to download entity changes");

                    // Send async fail confirmation
                    if (responseQueueName != null) {
                        let message = new RequestConfirmation();
                        message.request_id = requestId;
                        message.correlation_id = correlationId;
                        message.blob_ids = blobIds;
                        message.successful = false;
                        message.error = err.message;

                        var queue = this._references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue(responseQueueName));
                        queue.sendAsObject(correlationId, this.downloadChangesMessageType, message, (err) => {
                            this._logger.trace(correlationId, "Sent download changes failure response");
                        });
                    }
                }

                timing.endTiming();
                callback(err);
            }
        );
    }

    public uploadChanges(correlationId: string, blobIds: string[], responseQueueName: string, requestId: string, callback: (err: any) => void): void {
        var timing = this.instrument(correlationId, "uploadChanges", "from blobs " + blobIds + " to " + responseQueueName);

        var i = 0;
        async.whilst(
            () => i < blobIds.length,
            (callback) => {
                var blobId = blobIds[i];

                // Load data from the blob
                this._tempBlob.readBlobAsObject<DataChange<T>[]>(correlationId, blobId, (err, data) => {
                    if (err) {
                        callback(err);
                        return;
                    }

                    var j = 0;
                    async.whilst(
                        () => j < data.length,
                        (callback) => {
                            var change = data[j];
                            if (change.change_type == ChangeType.Created)
                                this.client.create(correlationId, change.data, (err, entity) => {
                                    j++;
                                    callback(err);
                                });
                            else if (change.change_type == ChangeType.Updated)
                                this.client.update(correlationId, change.data, (err, entity) => {
                                    j++;
                                    callback(err);
                                });
                            else if (change.change_type == ChangeType.Deleted) {
                                var entityId = TypeConverter.toType<K>(TypeCode.Object, change.id);
                                this.client.deleteById(correlationId, entityId, (err, entity) => {
                                    j++;
                                    callback(err);
                                });
                            }
                        },
                        (err) => {
                            i++;
                            callback(err);
                        }
                    );
                });
            },
            (err) => {
                if (err) {
                    this._logger.debug(correlationId, "Uploaded {0} changes from {1} blobs", this.service, blobIds.length);

                    // Send async confirmation
                    if (responseQueueName != null) {
                        var message = new RequestConfirmation();
                        message.request_id = requestId;
                        message.correlation_id = correlationId;
                        message.blob_ids = blobIds;
                        message.successful = true;

                        var queue = this._references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue(responseQueueName));
                        queue.sendAsObject(correlationId, this.uploadChangesMessageType, message, (err) => {
                            this._logger.trace(correlationId, "Send upload changes confirmation");
                        });
                    }
                }

                timing.endTiming();
                callback(err);
            }
        );
    }
}