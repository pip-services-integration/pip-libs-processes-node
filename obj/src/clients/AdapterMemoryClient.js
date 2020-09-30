"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdapterMemoryClient = void 0;
const _ = require('lodash');
let async = require('async');
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const pip_services3_components_node_1 = require("pip-services3-components-node");
const ClientParam_1 = require("./ClientParam");
const KnownDescriptors_1 = require("../logic/KnownDescriptors");
const CapabilitiesMap_1 = require("../data/CapabilitiesMap");
const ClientCapabilities_1 = require("./ClientCapabilities");
const RandomTestException_1 = require("./RandomTestException");
const EntityAlreadyExistException_1 = require("../data/EntityAlreadyExistException");
const ChangeType_1 = require("../data/ChangeType");
const RequestConfirmation_1 = require("../data/RequestConfirmation");
const BatchChangesHelper_1 = require("./BatchChangesHelper");
const EntityBatch_1 = require("../data/EntityBatch");
const BatchEventsHelper_1 = require("./BatchEventsHelper");
class AdapterMemoryClient {
    //private Semaphore _lock = new Semaphore(1,1);
    //private CancellationTokenSource _cancel = new CancellationTokenSource();
    constructor(adapter, service, entities, generator, references = null, parameters = null) {
        this._logger = new pip_services3_components_node_1.CompositeLogger();
        this._counters = new pip_services3_components_node_1.CompositeCounters();
        this._cancelSimulation = false;
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
        if (references != null)
            this.setReferences(references);
        // Autogenerate entities
        this.Generator = generator;
        this.Entities = entities !== null && entities !== void 0 ? entities : this.generateEntities();
        // Define capabilities
        this.Capabilities = new CapabilitiesMap_1.CapabilitiesMap();
        this.Capabilities.setAsObject(ClientCapabilities_1.ClientCapabilities.CanGetByFilter, true);
        this.Capabilities.setAsObject(ClientCapabilities_1.ClientCapabilities.CanGetBatches, true);
        this.Capabilities.setAsObject(ClientCapabilities_1.ClientCapabilities.CanGetOneById, true);
        this.Capabilities.setAsObject(ClientCapabilities_1.ClientCapabilities.CanCreate, true);
        this.Capabilities.setAsObject(ClientCapabilities_1.ClientCapabilities.CanUpdate, true);
        this.Capabilities.setAsObject(ClientCapabilities_1.ClientCapabilities.CanDelete, true);
        this.Capabilities.setAsObject(ClientCapabilities_1.ClientCapabilities.CanChangeNotify, true);
        this.Capabilities.setAsObject(ClientCapabilities_1.ClientCapabilities.CanDownloadAll, true);
        this.Capabilities.setAsObject(ClientCapabilities_1.ClientCapabilities.CanUploadAll, true);
        this.Capabilities.setAsObject(ClientCapabilities_1.ClientCapabilities.CanDownloadChanges, true);
        this.Capabilities.setAsObject(ClientCapabilities_1.ClientCapabilities.CanUploadChanges, true);
    }
    getDescriptor() {
        return new pip_services3_commons_node_1.Descriptor(this.Adapter, "client", "mock", this.Service, "1.0");
    }
    setReferences(references) {
        this._references = references;
        this._logger.setReferences(references);
        this._counters.setReferences(references);
        //this._parameterizer.SetReferences(this, references);
        this._tempBlob = this._references.getOneOptional(KnownDescriptors_1.KnownDescriptors.TempBlobs);
    }
    setParameters(parameters) {
        var _a;
        this._parameters = ((_a = this._parameters) !== null && _a !== void 0 ? _a : new pip_services3_commons_node_1.Parameters()).override(parameters);
        this.InitialNumberOfEntities = this._parameters.getAsIntegerWithDefault(ClientParam_1.ClientParam.InitialNumberOfEntities, this.InitialNumberOfEntities);
        this.InitialCreateTime = this._parameters.getAsDateTimeWithDefault(ClientParam_1.ClientParam.InitialCreateTime, this.InitialCreateTime);
        this.Disabled = this._parameters.getAsBooleanWithDefault(ClientParam_1.ClientParam.Disabled, this.Disabled);
        this.SimulationInterval = this._parameters.getAsIntegerWithDefault(ClientParam_1.ClientParam.SimulationInterval, this.SimulationInterval);
        this.NumberOfChanges = this._parameters.getAsIntegerWithDefault(ClientParam_1.ClientParam.NumberOfChanges, this.NumberOfChanges);
        this.ChangeNotifyQueue = this._parameters.getAsStringWithDefault(ClientParam_1.ClientParam.ChangeNotifyQueue, this.ChangeNotifyQueue);
        this.ChangeNotifyMessageType = this._parameters.getAsStringWithDefault(ClientParam_1.ClientParam.ChangeNotifyMessageType, this.ChangeNotifyMessageType);
        this.PageSize = this._parameters.getAsIntegerWithDefault(ClientParam_1.ClientParam.PageSize, this.PageSize);
        this.EntitiesPerBlob = this._parameters.getAsIntegerWithDefault(ClientParam_1.ClientParam.EntitiesPerBlob, this.EntitiesPerBlob);
        this.BlobTimeToLive = this._parameters.getAsIntegerWithDefault(ClientParam_1.ClientParam.BlobTimeToLive, this.BlobTimeToLive);
        this.CorrelationId = this._parameters.getAsStringWithDefault(ClientParam_1.ClientParam.CorrelationId, this.CorrelationId);
        this.DownloadAllMessageType = this._parameters.getAsStringWithDefault(ClientParam_1.ClientParam.DownloadAllMessageType, this.DownloadAllMessageType);
        this.UploadAllMessageType = this._parameters.getAsStringWithDefault(ClientParam_1.ClientParam.UploadAllMessageType, this.UploadAllMessageType);
        this.DownloadChangesMessageType = this._parameters.getAsStringWithDefault(ClientParam_1.ClientParam.DownloadChangesMessageType, this.DownloadChangesMessageType);
        this.UploadChangesMessageType = this._parameters.getAsStringWithDefault(ClientParam_1.ClientParam.UploadChangesMessageType, this.UploadChangesMessageType);
        this.ResponseTimeout = this._parameters.getAsIntegerWithDefault(ClientParam_1.ClientParam.ResponseTimeout, this.ResponseTimeout);
        this.ErrorProbability = this._parameters.getAsFloatWithDefault(ClientParam_1.ClientParam.ErrorProbability, this.ErrorProbability);
        this.DistortionsEnabled = this._parameters.getAsBooleanWithDefault(ClientParam_1.ClientParam.DistortionsEnabled, this.DistortionsEnabled);
        this.RandomErrorsEnabled = this._parameters.getAsBooleanWithDefault(ClientParam_1.ClientParam.RandomErrorsEnabled, this.RandomErrorsEnabled);
        this.ResponseTimeoutEnabled = this._parameters.getAsBooleanWithDefault(ClientParam_1.ClientParam.ResponseTimeoutEnabled, this.ResponseTimeoutEnabled);
        this.NoResponseEnabled = this._parameters.getAsBooleanWithDefault(ClientParam_1.ClientParam.NoResponseEnabled, this.NoResponseEnabled);
    }
    generateEntities() {
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
    delaySimulation(callback) {
        if (this.SimulationInterval == Number.MAX_SAFE_INTEGER) // Infinite
         {
            async.whilst(() => !this._cancelSimulation && this.SimulationInterval == Number.MAX_SAFE_INTEGER, (callback) => {
                setTimeout(callback, 60 * 1000); // 1min delay
            }, (err) => {
                this._cancelSimulation = false;
                callback(err);
            });
        }
        else {
            var interval = this.SimulationInterval;
            var timeout = 100;
            async.whilst(() => !this._cancelSimulation && interval > 0, (callback) => {
                setTimeout(() => {
                    interval -= timeout;
                    callback();
                }, timeout);
            }, (err) => {
                this._cancelSimulation = false;
                callback(err);
            });
        }
    }
    beginSimulation() {
        async.whilst(() => !this._cancelSimulation, (callback) => {
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
        }, (err) => {
        });
    }
    ;
    close(correlationId, callback) {
        this._cancelSimulation = true;
        if (callback)
            callback(null);
    }
    // Instrumentation
    instrument(correlationId, methodName, message = "") {
        this._logger.trace(correlationId !== null && correlationId !== void 0 ? correlationId : this.CorrelationId, "Called %s.%s.%s %s", this.Adapter, this.Service, methodName, message);
        return this._counters.beginTiming(this.Adapter + "." + this.Service + "." + methodName + ".call_time");
    }
    handleError(correlationId, methodName, error) {
        if (error) {
            this._logger.error(correlationId !== null && correlationId !== void 0 ? correlationId : this.CorrelationId, error, "Failed to call %s.%s.%s", this.Adapter, this.Service, methodName);
        }
        return error;
    }
    raiseRandomException(chance = 1) {
        if (this.RandomErrorsEnabled && this.ErrorProbability > 0 && pip_services3_commons_node_1.RandomBoolean.chance(this.ErrorProbability * 100, 100))
            throw new RandomTestException_1.RandomTestException();
    }
    beginExecute(action) {
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
    getCapabilities() {
        return this.Capabilities;
    }
    // IReadWriteClient interface implementation
    getByFilter(correlationId, filter, paging, callback) {
        filter = filter !== null && filter !== void 0 ? filter : new pip_services3_commons_node_1.FilterParams();
        var timing = this.instrument(correlationId, "getByFilter", "with filter " + filter.toString());
        try {
            // Raise random test exception
            this.raiseRandomException();
            var result = null;
            // Get filtered entities
            result = this.performGet(correlationId, filter);
            // Compose and return the page
            paging = paging !== null && paging !== void 0 ? paging : new pip_services3_commons_node_1.PagingParams();
            var skip = paging.getSkip(0);
            var take = paging.getTake(this.PageSize);
            var page = this.skipAndTake(result, skip, take);
            this._logger.debug(correlationId, "Returned %s of %s", page.length, this.Service);
            callback(null, new pip_services3_commons_node_1.DataPage(page, result.length));
        }
        catch (ex) {
            callback(this.handleError(correlationId, "getByFilter", ex), null);
        }
        finally {
            timing.endTiming();
        }
    }
    getOneById(correlationId, id, callback) {
        var timing = this.instrument(correlationId, "getOneById", "with id " + id);
        try {
            // Raise random test exception
            this.raiseRandomException();
            var entity = null;
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
    create(correlationId, entity, callback) {
        var timing = this.instrument(correlationId, "create", "entity " + entity);
        try {
            // Raise random test exception
            this.raiseRandomException();
            // Create a new entity
            entity = this.performCreate(correlationId, entity);
            this._logger.debug(correlationId, "Created %s %s", this.Service, entity);
            // Send change notification
            this.performChangeNotify(correlationId, entity, ChangeType_1.ChangeType.Created);
            callback(null, entity);
        }
        catch (ex) {
            callback(this.handleError(correlationId, "create", ex), null);
        }
        finally {
            timing.endTiming();
        }
    }
    update(correlationId, entity, callback) {
        var timing = this.instrument(correlationId, "update", "entity " + entity);
        try {
            // Raise random test exception
            this.raiseRandomException();
            // Delete the entity
            entity = this.performUpdate(correlationId, entity);
            // Send change notification
            this.performChangeNotify(correlationId, entity, ChangeType_1.ChangeType.Updated);
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
    deleteById(correlationId, id, callback) {
        var timing = this.instrument(correlationId, "deleteById", "with id " + id);
        try {
            // Raise random test exception
            this.raiseRandomException();
            // Delete entity
            var entity = null;
            entity = this.performDelete(correlationId, id.toString());
            // Send change notification
            if (entity != null) {
                this._logger.debug(correlationId, "Deleted %s %s", this.Service, entity);
                this.performChangeNotify(correlationId, entity, ChangeType_1.ChangeType.Deleted);
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
    skipAndTake(array, skip, take) {
        var page = array;
        if (skip > 0)
            page = _.slice(page, skip);
        page = _.take(page, take);
        return page;
    }
    toStringArray(value) {
        if (value == null)
            return null;
        var items = value.split(',');
        return items.length > 0 ? items : null;
    }
    performChangeNotify(correlationId, entity, changeType) {
        if (this.ChangeNotifyQueue == null)
            return;
        var changeNotifyQueue = this._references.getOneOptional(KnownDescriptors_1.KnownDescriptors.messageQueue(this.ChangeNotifyQueue));
        var entityId = this.isIdentifiable(entity) ? entity.id.toString() : null;
        var change = {
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
    performGet(correlationId, filter, filterFunc) {
        var _a, _b;
        // Define filters
        filter = filter !== null && filter !== void 0 ? filter : new pip_services3_commons_node_1.FilterParams();
        var id = filter.getAsNullableString("Id");
        var ids = this.toStringArray(filter.getAsNullableString("Ids"));
        var name = filter.getAsNullableString("Name");
        var changeFromTime = (_a = filter.getAsNullableDateTime("FromDateTime")) !== null && _a !== void 0 ? _a : filter.getAsNullableDateTime("ChangeFromTimeUtc");
        var changeToTime = (_b = filter.getAsNullableDateTime("ToDateTime")) !== null && _b !== void 0 ? _b : filter.getAsNullableDateTime("ChangeToTimeUtc");
        var created = filter.getAsNullableBoolean("IsCreated");
        var updated = filter.getAsNullableBoolean("IsUpdated");
        var deleted = filter.getAsNullableBoolean("IsDeleted");
        var result = [];
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
    performGetById(correlationId, id) {
        var result = null;
        for (let index = 0; index < this.Entities.length; index++) {
            const entity = this.Entities[index];
            if (!this.isIdentifiable(entity))
                continue;
            var entityId = entity.id;
            if (entityId != id)
                continue;
            if (!this.isChangeable(entity) || entity.deleted == false) {
                result = entity;
                break;
            }
        }
        return result;
    }
    performCreate(correlationId, entity) {
        // Validate required fields
        if (entity == null)
            throw new Error("Entity cannot be null");
        if (this.isIdentifiable(entity)) {
            if (!entity.id)
                throw new Error("Entity id is not set");
            // Check if entity already exist
            var oldEntity = this.performGetById(correlationId, entity.id.toString());
            if (oldEntity != null)
                throw new EntityAlreadyExistException_1.EntityAlreadyExistException(entity.id.toString(), "Duplicated entity was found");
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
    performFind(correlationId, entity) {
        if (this.isIdentifiable(entity)) {
            var id = entity.id;
            return this.performGetById(correlationId, id.toString());
        }
        return null;
    }
    performUpdate(correlationId, entity) {
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
    performDelete(correlationId, id) {
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
                var ie = entity;
                return ie != null ? ie.id.toString() : null;
            }).indexOf(id);
            if (index >= 0) {
                this.Entities.splice(index, 1);
            }
        }
        return entity;
    }
    // IBatchAllClient interface implementation
    downloadAll(correlationId, responseQueueName, requestId, callback) {
        var timing = this.instrument(correlationId, "downloadAll", "to " + responseQueueName);
        try {
            // If blob client is null then raise exception
            if (this._tempBlob == null)
                throw new Error("Reference to TempBlob storage is undefined");
            var blobIds = [];
            async.series([
                (callback) => {
                    try {
                        // Raise random test exception
                        this.raiseRandomException(3);
                        // Read all data
                        var data = this.performGet(correlationId, null);
                        this._logger.trace(correlationId, "Retrieved %s of all %s", data.length, this.Service);
                        var skip = 0;
                        async.whilst(() => skip < data.length, (callback) => {
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
                        }, (err) => {
                            callback(err);
                        });
                    }
                    catch (err) {
                        callback(err);
                    }
                },
            ], (err) => {
                this.sendConfirm(correlationId, this.DownloadAllMessageType, responseQueueName, requestId, err, blobIds, (err) => {
                    timing.endTiming();
                    callback(this.handleError(correlationId, "downloadAll", err));
                });
            });
        }
        catch (err) {
            timing.endTiming();
            callback(this.handleError(correlationId, "downloadAll", err));
        }
    }
    uploadAll(correlationId, blobIds, responseQueueName, requestId, callback) {
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
                        var data = [];
                        var i = 0;
                        async.whilst(() => i < blobIds.length, (callback) => {
                            var blobId = blobIds[i];
                            i++;
                            // Load data from the blob
                            this._tempBlob.readBlobAsObject(correlationId, blobId, (err, chunk) => {
                                // Apply changes
                                if (chunk != null) {
                                    data.push(...chunk);
                                    this._logger.trace(correlationId, "Uploaded %s %s from blob %s", chunk.length, this.Service, blobId);
                                }
                                callback(err);
                            });
                        }, (err) => {
                            this.Entities = data;
                            callback(err);
                        });
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
        }
        catch (err) {
            timing.endTiming();
            callback(this.handleError(correlationId, "uploadAll", err));
        }
    }
    sendConfirm(correlationId, messageType, responseQueueName, requestId, error, blobIds, callback) {
        var actionType = messageType == this.DownloadAllMessageType ? "Download" : "Upload";
        var actionDirection = messageType == this.DownloadAllMessageType ? "from" : "into";
        if (error)
            this._logger.error(correlationId, error, "Failed to %s all entities", actionType.toLowerCase());
        else
            this._logger.debug(correlationId, "%sed all %s %s %s blobs", actionType, this.Service, actionDirection, blobIds.length);
        // Send async confirmation
        if (responseQueueName != null) {
            // Raise random test exception
            this.raiseRandomException(3);
            let message = new RequestConfirmation_1.RequestConfirmation();
            message.request_id = requestId;
            message.correlation_id = correlationId;
            message.blob_ids = blobIds;
            message.successful = true;
            if (error) {
                message.successful = false;
                message.error = error.message;
            }
            var queue = this._references.getOneRequired(KnownDescriptors_1.KnownDescriptors.messageQueue(responseQueueName));
            queue.sendAsObject(correlationId, messageType, message, (err) => {
                if (error)
                    this._logger.trace(correlationId, "Sent %s failure response", actionType.toLowerCase());
                else
                    this._logger.trace(correlationId, "Sent %s confirmation", actionType.toLowerCase());
                callback(err);
            });
            return;
        }
        callback();
    }
    // IBatchChangesClient interface implementation
    downloadChanges(correlationId, filter, fromTime, toTime, responseQueueName, requestId, callback) {
        var helper = new BatchChangesHelper_1.BatchChangesHelper(this.Adapter, this.Service, this, this._references, this._parameters);
        helper.downloadChanges(correlationId, filter, fromTime, toTime, responseQueueName, requestId, callback);
    }
    uploadChanges(correlationId, blobIds, responseQueueName, requestId, callback) {
        var helper = new BatchChangesHelper_1.BatchChangesHelper(this.Adapter, this.Service, this, this._references, this._parameters);
        helper.uploadChanges(correlationId, blobIds, responseQueueName, requestId, callback);
    }
    // IEntityBatchClient interface implementation
    getBatches(correlationId, filter, paging, callback) {
        this.getByFilter(correlationId, filter, paging, (err, page) => {
            // Convert entities to single batches
            var entities = [];
            if (page != null && page.data != null && page.data.length > 0) {
                page.data.forEach((entity) => {
                    entities.push(new EntityBatch_1.EntityBatch(null, [entity]));
                });
            }
            callback(err, new pip_services3_commons_node_1.DataPage(entities, page.total));
        });
    }
    ackBatchById(correlationId, batchId, callback) {
        // Do nothing...
        callback(null);
    }
    // IBatchEventsClient interface implementation
    downloadEvents(correlationId, filter, fromTime, toTime, responseQueueName, requestId, callback) {
        var helper = new BatchEventsHelper_1.BatchEventsHelper(this.Adapter, this.Service, this, this._references, this._parameters);
        helper.downloadEvents(correlationId, filter, fromTime, toTime, responseQueueName, requestId, callback);
    }
    uploadEvents(correlationId, blobIds, responseQueueName, requestId, callback) {
        var helper = new BatchEventsHelper_1.BatchEventsHelper(this.Adapter, this.Service, this, this._references, this._parameters);
        helper.uploadEvents(correlationId, blobIds, responseQueueName, requestId, callback);
    }
    isChangeable(obj) {
        let changeable = obj;
        return changeable.deleted !== undefined || changeable.change_time !== undefined || changeable.create_time !== undefined;
    }
    isIdentifiable(obj) {
        let identifiable = obj;
        return identifiable.id !== undefined;
    }
    isNamed(obj) {
        let identifiable = obj;
        return identifiable.name !== undefined;
    }
}
exports.AdapterMemoryClient = AdapterMemoryClient;
AdapterMemoryClient._defaultParameters = pip_services3_commons_node_1.Parameters.fromTuples(ClientParam_1.ClientParam.InitialNumberOfEntities, 100, ClientParam_1.ClientParam.InitialCreateTime, new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // now - 100days
ClientParam_1.ClientParam.ResponseTimeout, 0, ClientParam_1.ClientParam.ChangeNotifyMessageType, "ChangeNotify", ClientParam_1.ClientParam.PageSize, 100, ClientParam_1.ClientParam.EntitiesPerBlob, 5000, ClientParam_1.ClientParam.SimulationInterval, Number.MAX_SAFE_INTEGER, // Infinite
ClientParam_1.ClientParam.NumberOfChanges, 1, ClientParam_1.ClientParam.DownloadAllMessageType, "DownloadAllResponse", ClientParam_1.ClientParam.UploadAllMessageType, "UploadAllResponse", ClientParam_1.ClientParam.DownloadChangesMessageType, "DownloadChangesResponse", ClientParam_1.ClientParam.UploadChangesMessageType, "UploadChangesResponse");
//# sourceMappingURL=AdapterMemoryClient.js.map