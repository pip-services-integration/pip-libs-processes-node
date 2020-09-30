const _ = require('lodash');
let async = require('async');

import { IReadWriteClient } from "./IReadWriteClient";
import { IReferenceable, IParameterized, Parameters, IReferences, Descriptor, RandomBoolean, FilterParams, PagingParams, DataPage, ITrackable, IIdentifiable, INamed } from "pip-services3-commons-node";
import { CompositeLogger, CompositeCounters, Timing } from "pip-services3-components-node";
import { ITempBlobsClientV1 } from "pip-clients-tempblobs-node";
import { RandomDataGenerator } from "../data/RandomDataGenerator";
import { IBatchAllClient } from "./IBatchAllClient";
import { IBatchChangesClient } from "./IBatchChangesClient";
import { IEntityBatchClient } from "./IEntityBatchClient";
import { IBatchEventsClient } from "./IBatchEventsClient";
import { ICapableClient } from "./ICapableClient";
import { ClientParam } from "./ClientParam";
import { KnownDescriptors } from "../logic/KnownDescriptors";
import { CapabilitiesMap } from "../data/CapabilitiesMap";
import { ClientCapabilities } from "./ClientCapabilities";
import { RandomTestException } from "./RandomTestException";
import { EntityAlreadyExistException } from "../data/EntityAlreadyExistException";
import { IMessageQueue, MessageEnvelope } from "pip-services3-messaging-node";
import { DataChange } from "../data/DataChange";
import { ChangeType } from "../data/ChangeType";
import { RequestConfirmation } from "../data/RequestConfirmation";
import { BatchChangesHelper } from "./BatchChangesHelper";
import { EntityBatch } from "../data/EntityBatch";
import { IChangeable } from "../data";
import { BatchEventsHelper } from "./BatchEventsHelper";

export class AdapterMemoryClient<T, K> implements ICapableClient,
    IReadWriteClient<T, K>,
    IBatchAllClient<T>,
    IBatchChangesClient<T>,
    IEntityBatchClient<T>,
    IBatchEventsClient<T>,
    //IDescriptable,
    IReferenceable,
    IParameterized {

    protected static readonly _defaultParameters: Parameters = Parameters.fromTuples(
        ClientParam.InitialNumberOfEntities, 100,
        ClientParam.InitialCreateTime, new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // now - 100days
        ClientParam.ResponseTimeout, 0,
        ClientParam.ChangeNotifyMessageType, "ChangeNotify",
        ClientParam.PageSize, 100,
        ClientParam.EntitiesPerBlob, 5000,

        ClientParam.SimulationInterval, Number.MAX_SAFE_INTEGER, // Infinite
        ClientParam.NumberOfChanges, 1,

        ClientParam.DownloadAllMessageType, "DownloadAllResponse",
        ClientParam.UploadAllMessageType, "UploadAllResponse",
        ClientParam.DownloadChangesMessageType, "DownloadChangesResponse",
        ClientParam.UploadChangesMessageType, "UploadChangesResponse"
    );

    protected _references: IReferences;
    protected _logger: CompositeLogger = new CompositeLogger();
    protected _counters: CompositeCounters = new CompositeCounters();
    //protected _parameterizer: ComponentParameterizer;
    protected _tempBlob: ITempBlobsClientV1;

    private _parameters: Parameters;
    //private Semaphore _lock = new Semaphore(1,1);
    //private CancellationTokenSource _cancel = new CancellationTokenSource();

    public constructor(adapter: string, service: string,
        entities: T[], generator: RandomDataGenerator<T>,
        references: IReferences = null, parameters: Parameters = null) {
        if (adapter == null)
            throw new Error("Adapter cannot be null");
        if (service == null)
            throw new Error("Service cannot be null");
        if (generator == null)
            throw new Error("Data generator cannot be null");

        // Define names for documentation
        this.Adapter = adapter;
        this.Service = service;
        //this._parameterizer = new ComponentParameterizer(Adapter + "." + Service);

        this.setParameters(AdapterMemoryClient._defaultParameters.override(parameters));
        if (references != null) this.setReferences(references);

        // Autogenerate entities
        this.Generator = generator;
        this.Entities = entities ?? this.generateEntities();

        // Define capabilities
        this.Capabilities = new CapabilitiesMap();
        this.Capabilities.setAsObject(ClientCapabilities.CanGetByFilter, true);
        this.Capabilities.setAsObject(ClientCapabilities.CanGetBatches, true);
        this.Capabilities.setAsObject(ClientCapabilities.CanGetOneById, true);
        this.Capabilities.setAsObject(ClientCapabilities.CanCreate, true);
        this.Capabilities.setAsObject(ClientCapabilities.CanUpdate, true);
        this.Capabilities.setAsObject(ClientCapabilities.CanDelete, true);
        this.Capabilities.setAsObject(ClientCapabilities.CanChangeNotify, true);
        this.Capabilities.setAsObject(ClientCapabilities.CanDownloadAll, true);
        this.Capabilities.setAsObject(ClientCapabilities.CanUploadAll, true);
        this.Capabilities.setAsObject(ClientCapabilities.CanDownloadChanges, true);
        this.Capabilities.setAsObject(ClientCapabilities.CanUploadChanges, true);
    }

    public Adapter: string;
    public Service: string;
    public Entities: T[];

    public Generator: RandomDataGenerator<T>;
    public Capabilities: CapabilitiesMap;

    public ChangeNotifyQueue: string;
    public ChangeNotifyMessageType: string;

    public InitialNumberOfEntities: number;
    public InitialCreateTime: Date;

    public Disabled: boolean;
    public CorrelationId: string;
    public PageSize: number;
    public EntitiesPerBlob: number;
    public BlobTimeToLive: number;
    public SimulationInterval: number;
    public NumberOfChanges: number;

    public ErrorProbability: number;
    public DistortionsEnabled: boolean;
    public RandomErrorsEnabled: boolean;
    public ResponseTimeout: number;
    public ResponseTimeoutEnabled: boolean;
    public NoResponseEnabled: boolean;

    public DownloadAllMessageType: string;
    public UploadAllMessageType: string;
    public DownloadChangesMessageType: string;
    public UploadChangesMessageType: string;

    public getDescriptor(): Descriptor {
        return new Descriptor(this.Adapter, "client", "mock", this.Service, "1.0");
    }

    public setReferences(references: IReferences) {
        this._references = references;
        this._logger.setReferences(references);
        this._counters.setReferences(references);
        //this._parameterizer.SetReferences(this, references);

        this._tempBlob = this._references.getOneOptional<ITempBlobsClientV1>(KnownDescriptors.TempBlobs);
    }

    public setParameters(parameters: Parameters) {
        this._parameters = (this._parameters ?? new Parameters()).override(parameters);

        this.InitialNumberOfEntities = this._parameters.getAsIntegerWithDefault(ClientParam.InitialNumberOfEntities, this.InitialNumberOfEntities);
        this.InitialCreateTime = this._parameters.getAsDateTimeWithDefault(ClientParam.InitialCreateTime, this.InitialCreateTime);

        this.Disabled = this._parameters.getAsBooleanWithDefault(ClientParam.Disabled, this.Disabled);
        this.SimulationInterval = this._parameters.getAsIntegerWithDefault(ClientParam.SimulationInterval, this.SimulationInterval);
        this.NumberOfChanges = this._parameters.getAsIntegerWithDefault(ClientParam.NumberOfChanges, this.NumberOfChanges);

        this.ChangeNotifyQueue = this._parameters.getAsStringWithDefault(ClientParam.ChangeNotifyQueue, this.ChangeNotifyQueue);
        this.ChangeNotifyMessageType = this._parameters.getAsStringWithDefault(ClientParam.ChangeNotifyMessageType, this.ChangeNotifyMessageType);

        this.PageSize = this._parameters.getAsIntegerWithDefault(ClientParam.PageSize, this.PageSize);
        this.EntitiesPerBlob = this._parameters.getAsIntegerWithDefault(ClientParam.EntitiesPerBlob, this.EntitiesPerBlob);
        this.BlobTimeToLive = this._parameters.getAsIntegerWithDefault(ClientParam.BlobTimeToLive, this.BlobTimeToLive);
        this.CorrelationId = this._parameters.getAsStringWithDefault(ClientParam.CorrelationId, this.CorrelationId);

        this.DownloadAllMessageType = this._parameters.getAsStringWithDefault(ClientParam.DownloadAllMessageType, this.DownloadAllMessageType);
        this.UploadAllMessageType = this._parameters.getAsStringWithDefault(ClientParam.UploadAllMessageType, this.UploadAllMessageType);
        this.DownloadChangesMessageType = this._parameters.getAsStringWithDefault(ClientParam.DownloadChangesMessageType, this.DownloadChangesMessageType);
        this.UploadChangesMessageType = this._parameters.getAsStringWithDefault(ClientParam.UploadChangesMessageType, this.UploadChangesMessageType);

        this.ResponseTimeout = this._parameters.getAsIntegerWithDefault(ClientParam.ResponseTimeout, this.ResponseTimeout);
        this.ErrorProbability = this._parameters.getAsFloatWithDefault(ClientParam.ErrorProbability, this.ErrorProbability);
        this.DistortionsEnabled = this._parameters.getAsBooleanWithDefault(ClientParam.DistortionsEnabled, this.DistortionsEnabled);
        this.RandomErrorsEnabled = this._parameters.getAsBooleanWithDefault(ClientParam.RandomErrorsEnabled, this.RandomErrorsEnabled);
        this.ResponseTimeoutEnabled = this._parameters.getAsBooleanWithDefault(ClientParam.ResponseTimeoutEnabled, this.ResponseTimeoutEnabled);
        this.NoResponseEnabled = this._parameters.getAsBooleanWithDefault(ClientParam.NoResponseEnabled, this.NoResponseEnabled);
    }

    protected generateEntities(): T[] {
        var result = this.Generator.createArray(this.InitialNumberOfEntities);
        result.forEach((entity) => {
            if (this.isChangeable(entity)) {
                entity.create_time = this.InitialCreateTime;
                entity.change_time = this.InitialCreateTime;
            }
        });

        this._logger.info(this.CorrelationId, "Generated %d random entities of %s", this.InitialNumberOfEntities, this.Service);

        return result;
    }

    private _cancelSimulation: boolean = false;

    private delaySimulation(callback: (err: any) => void) {
        if (this.SimulationInterval == Number.MAX_SAFE_INTEGER) // Infinite
        {
            async.whilst(
                () => !this._cancelSimulation && this.SimulationInterval == Number.MAX_SAFE_INTEGER,
                (callback) => {
                    setTimeout(callback, 60 * 1000); // 1min delay
                },
                (err) => {
                    this._cancelSimulation = false;
                    callback(err);
                }
            );
        }
        else {
            var interval = this.SimulationInterval;
            var timeout = 100;

            async.whilst(
                () => !this._cancelSimulation && interval > 0,
                (callback) => {
                    setTimeout(() => {
                        interval -= timeout;
                        callback();
                    }, timeout);
                },
                (err) => {
                    this._cancelSimulation = false;
                    callback(err);
                }
            );
        }
    }

    public beginSimulation() {
        async.whilst(
            () => !this._cancelSimulation,
            (callback) => {
                this.delaySimulation((err) => {
                    if (err) {
                        callback(err);
                        return;
                    }

                    if (!this.Disabled) {
                        try {
                            var generator = this.Generator;
                            var entities = this.Entities;
                            generator.changeArray(entities, this.NumberOfChanges);

                            //AdjustEntities();

                            // Distort data
                            if (this.ErrorProbability > 0 && this.DistortionsEnabled)
                                generator.distortArray(entities, this.NumberOfChanges, this.NumberOfChanges, this.ErrorProbability);

                            this._logger.info(this.CorrelationId, "Generated %s random changes of %s", this.NumberOfChanges, this.Service);
                        }
                        finally {
                            // ignore errors
                        }
                    }

                    callback();
                });
            },
            (err) => {
            }
        );
    };

    public close(correlationId: string, callback: (err: any) => void): void {
        this._cancelSimulation = true;
        if (callback) callback(null);
    }

    // Instrumentation
    protected instrument(correlationId: string, methodName: string, message: string = ""): Timing {
        this._logger.trace(correlationId ?? this.CorrelationId, "Called %s.%s.%s %s", this.Adapter, this.Service, methodName, message);
        return this._counters.beginTiming(this.Adapter + "." + this.Service + "." + methodName + ".call_time");
    }

    protected handleError(correlationId: string, methodName: string, error: Error): Error {
        if (error) {
            this._logger.error(correlationId ?? this.CorrelationId, error, "Failed to call %s.%s.%s", this.Adapter, this.Service, methodName);
        }
        return error;
    }

    private raiseRandomException(chance: number = 1) {
        if (this.RandomErrorsEnabled && this.ErrorProbability > 0 && RandomBoolean.chance(this.ErrorProbability * 100, 100))
            throw new RandomTestException();
    }

    protected beginExecute(action: () => void) {
        // Delay execution
        setTimeout(() => {
            try {
                // Perform action
                action();
            }
            catch (ex) {
                // Ignore errors...
                this._logger.error(this.CorrelationId, ex, "Error while asynchronous execution");
            }

        }, this.ResponseTimeout);
    }

    // ICapableClient interface implementation
    getCapabilities(): CapabilitiesMap {
        return this.Capabilities;
    }

    // IReadWriteClient interface implementation
    getByFilter(correlationId: string, filter: FilterParams, paging: PagingParams,
        callback: (err: any, page: DataPage<T>) => void): void {
        filter = filter ?? new FilterParams();
        var timing = this.instrument(correlationId, "getByFilter", "with filter " + filter.toString());

        try {
            // Raise random test exception
            this.raiseRandomException();

            var result: T[] = null;

            // Get filtered entities
            result = this.performGet(correlationId, filter);

            // Compose and return the page
            paging = paging ?? new PagingParams();
            var skip = paging.getSkip(0);
            var take = paging.getTake(this.PageSize);

            var page = this.skipAndTake(result, skip, take);

            this._logger.debug(correlationId, "Returned %s of %s", page.length, this.Service);

            callback(null, new DataPage<T>(page, result.length));
        }
        catch (ex) {
            callback(this.handleError(correlationId, "getByFilter", ex), null);
        }
        finally {
            timing.endTiming();
        }
    }

    getOneById(correlationId: string, id: K, callback: (err: any, entity: T) => void): void {
        var timing = this.instrument(correlationId, "getOneById", "with id " + id);
        try {
            // Raise random test exception
            this.raiseRandomException();

            var entity: T = null;

            entity = this.performGetById(correlationId, id.toString());

            if (entity != null)
                this._logger.debug(correlationId, "Returned %s", entity);
            else
                this._logger.debug(correlationId, "Could not find %s by %s", this.Service, id);

            callback(null, entity);
        }
        catch (ex) {
            callback(this.handleError(correlationId, "getOneById", ex), null);
        }
        finally {
            timing.endTiming();
        }
    }

    create(correlationId: string, entity: T, callback: (err: any, entity: T) => void): void {
        var timing = this.instrument(correlationId, "create", "entity " + entity);
        try {
            // Raise random test exception
            this.raiseRandomException();

            // Create a new entity
            entity = this.performCreate(correlationId, entity);

            this._logger.debug(correlationId, "Created %s %s", this.Service, entity);

            // Send change notification
            this.performChangeNotify(correlationId, entity, ChangeType.Created);

            callback(null, entity);
        }
        catch (ex) {
            callback(this.handleError(correlationId, "create", ex), null);
        }
        finally {
            timing.endTiming();
        }
    }

    update(correlationId: string, entity: T, callback: (err: any, entity: T) => void): void {
        var timing = this.instrument(correlationId, "update", "entity " + entity);
        try {
            // Raise random test exception
            this.raiseRandomException();

            // Delete the entity
            entity = this.performUpdate(correlationId, entity);

            // Send change notification
            this.performChangeNotify(correlationId, entity, ChangeType.Updated);

            this._logger.debug(correlationId, "Updated %s %s", this.Service, entity);
            callback(null, entity);
        }
        catch (ex) {
            callback(this.handleError(correlationId, "update", ex), null);
        }
        finally {
            timing.endTiming();
        }
    }

    deleteById(correlationId: string, id: K, callback: (err: any, entity: T) => void): void {
        var timing = this.instrument(correlationId, "deleteById", "with id " + id);
        try {
            // Raise random test exception
            this.raiseRandomException();

            // Delete entity
            var entity: T = null;

            entity = this.performDelete(correlationId, id.toString());

            // Send change notification
            if (entity != null) {
                this._logger.debug(correlationId, "Deleted %s %s", this.Service, entity);
                this.performChangeNotify(correlationId, entity, ChangeType.Deleted);
            }
            else {
                this._logger.debug(correlationId, "Already deleted %s with key %s", this.Service, id);
            }

            callback(null, entity);
        }
        catch (ex) {
            callback(this.handleError(correlationId, "deleteById", ex), null);
        }
        finally {
            timing.endTiming();
        }
    }

    private skipAndTake(array: T[], skip: number, take: number): T[] {
        var page = array;
        if (skip > 0)
            page = _.slice(page, skip);
        page = _.take(page, take);

        return page;
    }

    private toStringArray(value: string): string[] {
        if (value == null) return null;
        var items = value.split(',');
        return items.length > 0 ? items : null;
    }

    protected performChangeNotify(correlationId: string, entity: T, changeType: string) {
        if (this.ChangeNotifyQueue == null) return;

        var changeNotifyQueue = this._references.getOneOptional<IMessageQueue>(KnownDescriptors.messageQueue(this.ChangeNotifyQueue));

        var entityId = this.isIdentifiable<string>(entity) ? entity.id.toString() : null;

        var change: DataChange<T> =
        {
            change_time: new Date(),
            data: entity,
            id: entityId,
            change_type: changeType
        };

        var message = [change];

        // Do not wait sending
        changeNotifyQueue.sendAsObject(correlationId, this.ChangeNotifyMessageType, message, (err) => {
            this._logger.debug(correlationId, "Sent change for %s %s", this.Service, entity);
        });
    }

    protected performGet(correlationId: string, filter: FilterParams, filterFunc?: (item: T) => boolean) {
        // Define filters
        filter = filter ?? new FilterParams();
        var id = filter.getAsNullableString("Id");
        var ids = this.toStringArray(filter.getAsNullableString("Ids"));
        var name = filter.getAsNullableString("Name");
        var changeFromTime = filter.getAsNullableDateTime("FromDateTime")
            ?? filter.getAsNullableDateTime("ChangeFromTimeUtc");
        var changeToTime = filter.getAsNullableDateTime("ToDateTime")
            ?? filter.getAsNullableDateTime("ChangeToTimeUtc");
        var created = filter.getAsNullableBoolean("IsCreated");
        var updated = filter.getAsNullableBoolean("IsUpdated");
        var deleted = filter.getAsNullableBoolean("IsDeleted");

        var result: T[] = [];

        // Filter collection, get results
        this.Entities.forEach((entity) => {
            // Filters for identifiable entities

            if (this.isIdentifiable(entity)) {
                var entityId = entity.id.toString();

                // Process Id filter
                if (id != null && id != entityId)
                    return;

                // Process Ids filter
                if (ids != null && !ids.includes(entityId))
                    return;
            }

            // Filters for named entities
            if (this.isNamed(entity)) {
                // Process Name filter
                if (name != null && name != entity.name)
                    return;
            }

            // Filters for change tracking
            if (this.isChangeable(entity)) {
                // Process ChangeFromTimeUtc filter
                if (changeFromTime != null && entity.change_time <= changeFromTime)
                    return;

                // Process ChangeToTimeUtc filter
                if (changeToTime != null && entity.change_time > changeToTime)
                    return;

                // Process created, updated and deleted filters
                if (created != null || updated != null || deleted != null) {
                    var confirming = false;

                    if (created != null && entity.deleted == false && entity.create_time == entity.change_time)
                        confirming = true;
                    if (updated != null && entity.deleted == false && entity.create_time != entity.change_time)
                        confirming = true;
                    if (deleted != null && entity.deleted)
                        confirming = true;

                    if (confirming == false)
                        return;
                }
            }

            if (filterFunc != null && filterFunc(entity) == false)
                return;

            result.push(entity);
        });

        return result;
    }

    protected performGetById(correlationId: string, id: string): T {
        var result: T = null;

        for (let index = 0; index < this.Entities.length; index++) {
            const entity = this.Entities[index];

            if (!this.isIdentifiable<string>(entity)) continue;

            var entityId = entity.id;
            if (entityId != id) continue;

            if (!this.isChangeable(entity) || entity.deleted == false) {
                result = entity;
                break;
            }
        }

        return result;
    }

    protected performCreate(correlationId: string, entity: T): T {
        // Validate required fields
        if (entity == null)
            throw new Error("Entity cannot be null");

        if (this.isIdentifiable(entity)) {
            if (!entity.id)
                throw new Error("Entity id is not set");

            // Check if entity already exist
            var oldEntity = this.performGetById(correlationId, entity.id.toString());
            if (oldEntity != null)
                throw new EntityAlreadyExistException(entity.id.toString(), "Duplicated entity was found");
        }

        // Update auto fields
        entity = this.Generator.clone(entity);

        if (this.isChangeable(entity)) {
            var now = new Date();
            entity.create_time = entity.create_time ? entity.create_time : now;
            entity.change_time = entity.change_time ? entity.change_time : now;
            entity.deleted = false;
        }

        // Add to collection
        this.Entities.push(entity);

        return entity;
    }

    protected performFind(correlationId: string, entity: T): T {
        if (this.isIdentifiable(entity)) {
            var id = entity.id;
            return this.performGetById(correlationId, id.toString());
        }

        return null;
    }

    protected performUpdate(correlationId: string, entity: T): T {
        // Validate required fields
        if (entity == null)
            throw new Error("Entity cannot be null");

        // Update auto fields
        entity = this.Generator.clone(entity);

        if (this.isChangeable(entity)) {
            entity.change_time = entity.change_time ? entity.change_time : new Date();
            entity.deleted = false;
        }

        // Find and update the entity
        var currentEntity = this.performFind(correlationId, entity);

        if (currentEntity != null) {
            var index = this.Entities.indexOf(currentEntity);
            this.Entities[index] = entity;
        }
        else {
            entity = this.performCreate(correlationId, entity);
        }

        return entity;
    }

    protected performDelete(correlationId: string, id: string): T {
        // Find the entity
        var entity = this.performGetById(correlationId, id);

        if (entity == null)
            return null;

        if (this.isChangeable(entity)) {
            // If it was deleted do nothing
            if (entity.deleted == true)
                return null;

            entity.deleted = true;
            entity.change_time = new Date();
        }
        else {
            var index = this.Entities.map((x) => {
                var ie = entity as any as IIdentifiable<K>;
                return ie != null ? ie.id.toString() : null;
            }).indexOf(id);

            if (index >= 0) {
                this.Entities.splice(index, 1);
            }
        }

        return entity;
    }

    // IBatchAllClient interface implementation
    public downloadAll(correlationId: string, responseQueueName: string, requestId: string,
        callback: (err: any) => void): void {

        var timing = this.instrument(correlationId, "downloadAll", "to " + responseQueueName);
        try {
            // If blob client is null then raise exception
            if (this._tempBlob == null)
                throw new Error("Reference to TempBlob storage is undefined");

            var blobIds: string[] = [];

            async.series([
                (callback) => {
                    try {
                        // Raise random test exception
                        this.raiseRandomException(3);

                        // Read all data
                        var data = this.performGet(correlationId, null);

                        this._logger.trace(correlationId, "Retrieved %s of all %s", data.length, this.Service);

                        var skip = 0;
                        async.whilst(
                            () => skip < data.length,
                            (callback) => {
                                // Get a chunk
                                var chunk = this.skipAndTake(data, skip, this.EntitiesPerBlob);
                                skip += chunk.length;

                                // Write data to temporary blob
                                if (chunk.length > 0) {
                                    this._tempBlob.writeBlobAsObject(correlationId, chunk, this.BlobTimeToLive, (err, blobId) => {
                                        blobIds.push(blobId);
                                        this._logger.trace(correlationId, "Downloaded %s %s into blob %s", chunk.length, this.Service, blobId);
                                        callback(err);
                                    });
                                }
                            },
                            (err) => {
                                callback(err);
                            }
                        );
                    } catch (err) {
                        callback(err);
                    }
                },
            ], (err) => {
                this.sendConfirm(correlationId, this.DownloadAllMessageType, responseQueueName, requestId, err, blobIds, (err) => {
                    timing.endTiming();
                    callback(this.handleError(correlationId, "downloadAll", err));
                });
            });
        } catch (err) {
            timing.endTiming();
            callback(this.handleError(correlationId, "downloadAll", err));
        }
    }

    public uploadAll(correlationId: string, blobIds: string[], responseQueueName: string, requestId: string,
        callback: (err: any) => void): void {

        var timing = this.instrument(correlationId, "uploadAll", "from blobs " + blobIds + " to " + responseQueueName);
        try {
            // If blob client is null then raise exception
            if (this._tempBlob == null)
                throw new Error("Reference to TempBlob storage is undefined");

            async.series([
                (callback) => {
                    try {
                        // Raise random test exception
                        this.raiseRandomException(3);

                        var data: T[] = [];

                        var i = 0;
                        async.whilst(
                            () => i < blobIds.length,
                            (callback) => {
                                var blobId = blobIds[i];
                                i++;

                                // Load data from the blob
                                this._tempBlob.readBlobAsObject<T[]>(correlationId, blobId, (err, chunk) => {
                                    // Apply changes
                                    if (chunk != null) {
                                        data.push(...chunk);
                                        this._logger.trace(correlationId, "Uploaded %s %s from blob %s", chunk.length, this.Service, blobId);
                                    }
                                    callback(err);
                                });
                            },
                            (err) => {
                                this.Entities = data;
                                callback(err);
                            }
                        );
                    }
                    catch (err) {
                        callback(err);
                    }
                },
            ], (err) => {
                this.sendConfirm(correlationId, this.UploadAllMessageType, responseQueueName, requestId, err, blobIds, (err) => {
                    timing.endTiming();
                    callback(this.handleError(correlationId, "uploadAll", err));
                });
            });
        } catch (err) {
            timing.endTiming();
            callback(this.handleError(correlationId, "uploadAll", err));
        }
    }

    private sendConfirm(correlationId: string, messageType: string, responseQueueName: string, requestId: string, error: any, blobIds: string[],
        callback: (err?: any) => void) {

        var actionType = messageType == this.DownloadAllMessageType ? "Download" : "Upload";
        var actionDirection = messageType == this.DownloadAllMessageType ? "from" : "into";

        if (error) this._logger.error(correlationId, error, "Failed to %s all entities", actionType.toLowerCase());
        else this._logger.debug(correlationId, "%sed all %s %s %s blobs", actionType, this.Service, actionDirection, blobIds.length);

        // Send async confirmation
        if (responseQueueName != null) {

            // Raise random test exception
            this.raiseRandomException(3);

            let message = new RequestConfirmation();
            message.request_id = requestId;
            message.correlation_id = correlationId;
            message.blob_ids = blobIds;
            message.successful = true;

            if (error) {
                message.successful = false;
                message.error = error.message;
            }

            var queue = this._references.getOneRequired<IMessageQueue>(KnownDescriptors.messageQueue(responseQueueName));
            queue.sendAsObject(correlationId, messageType, message, (err) => {
                if (error) this._logger.trace(correlationId, "Sent %s failure response", actionType.toLowerCase());
                else this._logger.trace(correlationId, "Sent %s confirmation", actionType.toLowerCase());
                callback(err);
            });

            return;
        }

        callback();
    }

    // IBatchChangesClient interface implementation
    public downloadChanges(correlationId: string, filter: FilterParams, fromTime: Date, toTime: Date,
        responseQueueName: string, requestId: string, callback: (err: any) => void): void {
        var helper = new BatchChangesHelper<T, K>(this.Adapter, this.Service, this, this._references, this._parameters);
        helper.downloadChanges(correlationId, filter, fromTime, toTime, responseQueueName, requestId, callback);
    }

    public uploadChanges(correlationId: string, blobIds: string[], responseQueueName: string, requestId: string,
        callback: (err: any) => void): void {
        var helper = new BatchChangesHelper<T, K>(this.Adapter, this.Service, this, this._references, this._parameters);
        helper.uploadChanges(correlationId, blobIds, responseQueueName, requestId, callback);
    }

    // IEntityBatchClient interface implementation
    public getBatches(correlationId: string, filter: FilterParams, paging: PagingParams,
        callback: (err: any, page: DataPage<EntityBatch<T>>) => void) {
        this.getByFilter(correlationId, filter, paging, (err, page) => {
            // Convert entities to single batches
            var entities: EntityBatch<T>[] = [];
            if (page != null && page.data != null && page.data.length > 0) {
                page.data.forEach((entity) => {
                    entities.push(new EntityBatch<T>(null, [entity]));
                });
            }

            callback(err, new DataPage<EntityBatch<T>>(entities, page.total));
        });
    }

    public ackBatchById(correlationId: string, batchId: string,
        callback: (err: any) => void) {
        // Do nothing...
        callback(null);
    }

    // IBatchEventsClient interface implementation
    public downloadEvents(correlationId: string, filter: FilterParams, fromTime: Date,
        toTime: Date, responseQueueName: string, requestId?: string,
        callback?: (err: any) => void): void {
        var helper = new BatchEventsHelper<T, K>(this.Adapter, this.Service, this, this._references, this._parameters);
        helper.downloadEvents(correlationId, filter, fromTime, toTime, responseQueueName, requestId, callback);
    }

    public uploadEvents(correlationId: string, blobIds: string[], responseQueueName: string, requestId?: string,
        callback?: (err: any) => void): void {
        var helper = new BatchEventsHelper<T, K>(this.Adapter, this.Service, this, this._references, this._parameters);
        helper.uploadEvents(correlationId, blobIds, responseQueueName, requestId, callback);
    }

    private isChangeable(obj: any): obj is IChangeable {
        let changeable = obj as IChangeable;
        return changeable.deleted !== undefined || changeable.change_time !== undefined || changeable.create_time !== undefined;
    }

    private isIdentifiable<K>(obj: any): obj is IIdentifiable<K> {
        let identifiable = obj as IIdentifiable<K>;
        return identifiable.id !== undefined;
    }

    private isNamed(obj: any): obj is INamed {
        let identifiable = obj as INamed;
        return identifiable.name !== undefined;
    }
}