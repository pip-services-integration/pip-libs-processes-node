let async = require('async');

import { IParameterized } from "pip-services3-commons-node";
import { Parameters } from "pip-services3-commons-node";
import { IReferenceable } from "pip-services3-commons-node";
import { IReferences } from "pip-services3-commons-node";
import { ApplicationException } from "pip-services3-commons-node";
import { FilterParams } from "pip-services3-commons-node";
import { StringConverter } from "pip-services3-commons-node";
import { PagingParams } from "pip-services3-commons-node";
import { IIdentifiable } from "pip-services3-commons-node";
import { TypeConverter } from "pip-services3-commons-node";
import { TypeCode } from "pip-services3-commons-node";
import { ITempBlobsClientV1 } from "pip-clients-tempblobs-node";
import { CompositeCounters } from "pip-services3-components-node";
import { CompositeLogger } from "pip-services3-components-node";
import { Timing } from "pip-services3-components-node";
import { KnownDescriptors } from "../logic/KnownDescriptors";
import { IntegrationEvent } from "../data/IntegrationEvent";
import { EventTypes } from "../data/EventTypes";
import { IChangeable } from "../data/IChangeable";
import { IMessageQueue, MessageEnvelope } from "pip-services3-messaging-node";
import { RequestConfirmation } from "../data/RequestConfirmation";
import { IBatchEventsClient } from "./IBatchEventsClient";
import { ClientParam } from "./ClientParam";
import { IReadWriteClient } from "./IReadWriteClient";

export class BatchEventsHelper<T, K> implements IBatchEventsClient<T>, IReferenceable, IParameterized {
    private readonly _defaultParameters: Parameters = Parameters.fromTuples(
        ClientParam.PageSize, 100,
        ClientParam.EntitiesPerBlob, 100,
        ClientParam.BlobTimeToLive, 24 * 60 * 60 * 1000, // 1 day
        ClientParam.DownloadEventsMessageType, "DownloadEventsResponse",
        ClientParam.UploadEventsMessageType, "UploadEventsResponse"
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

    public downloadEventsMessageType: string;
    public uploadEventsMessageType: string;


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

        this.setParameters(this._defaultParameters.override(parameters));
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

        this.downloadEventsMessageType = parameters.getAsStringWithDefault(
            ClientParam.DownloadEventsMessageType, this.downloadEventsMessageType);
        this.uploadEventsMessageType = parameters.getAsStringWithDefault(
            ClientParam.UploadEventsMessageType, this.uploadEventsMessageType);
    }

    protected instrument(correlationId: string, methodName: string, message: string = ""): Timing {
        this._logger.trace(correlationId ?? this.correlationId, "Called %s.%s.%s %s", this.adapter, this.service, methodName, message);
        return this._counters.beginTiming(this.adapter + "." + this.service + "." + methodName + ".call_time");
    }

    protected handleError(correlationId: string, methodName: string, error: any): any {
        this._logger.error(correlationId ?? this.correlationId, error, "Failed to call %s.%s.%s", this.adapter, this.service, methodName);
        return error;
    }

    private isChangeable(obj: any): obj is IChangeable {
        let changeable = obj as IChangeable;
        return changeable.deleted !== undefined;
    }

    private isIdentifiable<K>(obj: any): obj is IIdentifiable<K> {
        let identifiable = obj as IIdentifiable<K>;
        return identifiable.id !== undefined;
    }

    public downloadEvents(correlationId: string, filter: FilterParams, fromTime: Date, toTime: Date, responseQueueName: string, requestId?: string,
        callback?: (err: any) => void): void {

        filter = filter ?? new FilterParams();

        var timing = this.instrument(correlationId, "downloadEvents", "with filter " + filter.toString() +
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

                    var events: IntegrationEvent[] = [];
                    var now = new Date();

                    var i = 0;
                    async.whilst(
                        () => i < chunk.length,
                        (callback) => {
                            let entity = chunk[i];

                            let changeType = EventTypes.Updated;
                            let changeTime = now;
                            let id: string = null;

                            if (this.isChangeable(entity)) {
                                if (entity.deleted)
                                    changeType = EventTypes.Deleted;

                                if (entity.create_time == entity.change_time)
                                    changeType = EventTypes.Created;

                                changeTime = entity.change_time;
                            }

                            // Clarify entity id
                            if (this.isIdentifiable<K>(entity)) {
                                let identifiable = entity as IIdentifiable<K>;
                                id = identifiable.id.toString();
                            }

                            let event = <IntegrationEvent>
                                {
                                    create_time: now,
                                    change_time: changeTime,
                                    id: id,
                                    type: changeType
                                };
                            event.setObject<T>(entity);
                            events.push(event);

                            i++;

                            callback();
                        },
                        (err) => {
                            if (err) {
                                callback(err);
                                return;
                            }

                            this._tempBlob.writeBlobAsObject(correlationId, events, this.blobTimeToLive, (err, blobId) => {
                                if (err) {
                                    callback(err);
                                    return;
                                }

                                blobIds.push(blobId);
                                this._logger.trace(correlationId, "Downloaded %s %s into blob %s", chunk.length, this.service, blobId);
                                callback();
                            });
                        }
                    );
                });
            },
            (err) => {
                this.sendConfirm(correlationId, this.downloadEventsMessageType, responseQueueName, requestId, err, blobIds, (err) => {
                    timing.endTiming();
                    callback(err);
                });
            }
        );
    }

    public uploadEvents(correlationId: string, blobIds: string[], responseQueueName: string, requestId?: string,
        callback?: (err: any) => void): void {
        var timing = this.instrument(correlationId, "uploadChanges", "from blobs " + blobIds + " to " + responseQueueName);

        var i = 0;
        async.whilst(
            () => i < blobIds.length,
            (callback) => {
                var blobId = blobIds[i];

                // Load data from the blob
                this._tempBlob.readBlobAsObject<IntegrationEvent[]>(correlationId, blobId, (err, data) => {
                    if (err) {
                        callback(err);
                        return;
                    }

                    var j = 0;
                    async.whilst(
                        () => j < data.length,
                        (callback) => {
                            var change = data[j];
                            var entity = change.getObject<T>();

                            if (change.type == EventTypes.Created)
                                this.client.create(correlationId, entity, (err, entity) => {
                                    j++;
                                    callback(err);
                                });
                            else if (change.type == EventTypes.Updated)
                                this.client.update(correlationId, entity, (err, entity) => {
                                    j++;
                                    callback(err);
                                });
                            else if (change.type == EventTypes.Deleted) {
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
                this.sendConfirm(correlationId, this.uploadEventsMessageType, responseQueueName, requestId, err, blobIds, (err) => {
                    timing.endTiming();
                    callback(err);
                });
            }
        );
    }
    
    private sendConfirm(correlationId: string, messageType: string, responseQueueName: string, requestId: string, err: any, blobIds: string[],
        callback: (err?: any) => void) {

        var actionType: string = messageType == this.downloadEventsMessageType ? "Download" : "Upload";

        if (err) this._logger.error(correlationId, err, "Failed to %s entity events", actionType.toLowerCase());
        else this._logger.debug(correlationId, "%sed %s events into %s blobs", actionType, this.service, blobIds.length);

        // Send async confirmation
        if (responseQueueName != null) {
            let message = new RequestConfirmation();
            message.request_id = requestId;
            message.correlation_id = correlationId;
            message.blob_ids = blobIds;
            message.successful = true;

            if (err) {
                message.successful = false;
                message.error = err.message;
            }

            var envelope = new MessageEnvelope(correlationId, messageType, JSON.stringify(message));

            var queue = this._references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue(responseQueueName));
            queue.send(correlationId, envelope, (err1) => {
                if (err) this._logger.trace(correlationId, "Sent %s events failure response", actionType.toLowerCase());
                else this._logger.trace(correlationId, "Sent %s events confirmation", actionType.toLowerCase());
                callback(err);
            });

            return;
        }

        callback();
    }
}