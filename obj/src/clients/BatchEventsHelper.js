"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchEventsHelper = void 0;
let async = require('async');
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const pip_services3_commons_node_2 = require("pip-services3-commons-node");
const pip_services3_commons_node_3 = require("pip-services3-commons-node");
const pip_services3_commons_node_4 = require("pip-services3-commons-node");
const pip_services3_commons_node_5 = require("pip-services3-commons-node");
const pip_services3_commons_node_6 = require("pip-services3-commons-node");
const pip_services3_commons_node_7 = require("pip-services3-commons-node");
const pip_services3_components_node_1 = require("pip-services3-components-node");
const pip_services3_components_node_2 = require("pip-services3-components-node");
const KnownDescriptors_1 = require("../logic/KnownDescriptors");
const EventTypes_1 = require("../data/EventTypes");
const pip_services3_messaging_node_1 = require("pip-services3-messaging-node");
const RequestConfirmation_1 = require("../data/RequestConfirmation");
const ClientParam_1 = require("./ClientParam");
class BatchEventsHelper {
    constructor(adapter, service, client, references, parameters) {
        this._defaultParameters = pip_services3_commons_node_1.Parameters.fromTuples(ClientParam_1.ClientParam.PageSize, 100, ClientParam_1.ClientParam.EntitiesPerBlob, 100, ClientParam_1.ClientParam.BlobTimeToLive, 24 * 60 * 60 * 1000, // 1 day
        ClientParam_1.ClientParam.DownloadEventsMessageType, "DownloadEventsResponse", ClientParam_1.ClientParam.UploadEventsMessageType, "UploadEventsResponse");
        this._logger = new pip_services3_components_node_2.CompositeLogger();
        this._counters = new pip_services3_components_node_1.CompositeCounters();
        this._tempBlob = null;
        if (adapter == null)
            throw new pip_services3_commons_node_2.ApplicationException("Adapter cannot be null");
        if (service == null)
            throw new pip_services3_commons_node_2.ApplicationException("Service cannot be null");
        if (client == null)
            throw new pip_services3_commons_node_2.ApplicationException("Client cannot be null");
        this.adapter = adapter;
        this.service = service;
        this.client = client;
        this.setParameters(this._defaultParameters.override(parameters));
        if (references != null)
            this.setReferences(references);
    }
    setReferences(references) {
        this._references = references;
        this._logger.setReferences(references);
        this._counters.setReferences(references);
        this._tempBlob = references.getOneOptional(KnownDescriptors_1.KnownDescriptors.TempBlobs);
    }
    setParameters(parameters) {
        this.pageSize = parameters.getAsIntegerWithDefault(ClientParam_1.ClientParam.PageSize, this.pageSize);
        this.entitiesPerBlob = parameters.getAsIntegerWithDefault(ClientParam_1.ClientParam.EntitiesPerBlob, this.entitiesPerBlob);
        this.blobTimeToLive = parameters.getAsLongWithDefault(ClientParam_1.ClientParam.BlobTimeToLive, this.blobTimeToLive);
        this.correlationId = parameters.getAsStringWithDefault(ClientParam_1.ClientParam.CorrelationId, this.correlationId);
        this.downloadEventsMessageType = parameters.getAsStringWithDefault(ClientParam_1.ClientParam.DownloadEventsMessageType, this.downloadEventsMessageType);
        this.uploadEventsMessageType = parameters.getAsStringWithDefault(ClientParam_1.ClientParam.UploadEventsMessageType, this.uploadEventsMessageType);
    }
    instrument(correlationId, methodName, message = "") {
        this._logger.trace(correlationId !== null && correlationId !== void 0 ? correlationId : this.correlationId, "Called %s.%s.%s %s", this.adapter, this.service, methodName, message);
        return this._counters.beginTiming(this.adapter + "." + this.service + "." + methodName + ".call_time");
    }
    handleError(correlationId, methodName, error) {
        this._logger.error(correlationId !== null && correlationId !== void 0 ? correlationId : this.correlationId, error, "Failed to call %s.%s.%s", this.adapter, this.service, methodName);
        return error;
    }
    isChangeable(obj) {
        let changeable = obj;
        return changeable.deleted !== undefined;
    }
    isIdentifiable(obj) {
        let identifiable = obj;
        return identifiable.id !== undefined;
    }
    downloadEvents(correlationId, filter, fromTime, toTime, responseQueueName, requestId, callback) {
        filter = filter !== null && filter !== void 0 ? filter : new pip_services3_commons_node_3.FilterParams();
        var timing = this.instrument(correlationId, "downloadEvents", "with filter " + filter.toString() +
            " from " + pip_services3_commons_node_4.StringConverter.toString(fromTime) + " to " + responseQueueName);
        var blobIds = [];
        var chunk = [];
        var skip = 0;
        async.whilst(() => chunk.length < this.pageSize || chunk.length == 0, (callback) => {
            // Get a chunk
            var paging = new pip_services3_commons_node_5.PagingParams(skip, this.entitiesPerBlob, false);
            this.client.getByFilter(correlationId, filter, paging, (err, page) => {
                var _a;
                if (err) {
                    callback(err);
                    return;
                }
                chunk = (_a = page.data) !== null && _a !== void 0 ? _a : [];
                skip += chunk.length;
                var events = [];
                var now = new Date();
                var i = 0;
                async.whilst(() => i < chunk.length, (callback) => {
                    let entity = chunk[i];
                    let changeType = EventTypes_1.EventTypes.Updated;
                    let changeTime = now;
                    let id = null;
                    if (this.isChangeable(entity)) {
                        if (entity.deleted)
                            changeType = EventTypes_1.EventTypes.Deleted;
                        if (entity.create_time == entity.change_time)
                            changeType = EventTypes_1.EventTypes.Created;
                        changeTime = entity.change_time;
                    }
                    // Clarify entity id
                    if (this.isIdentifiable(entity)) {
                        let identifiable = entity;
                        id = identifiable.id.toString();
                    }
                    let event = {
                        create_time: now,
                        change_time: changeTime,
                        id: id,
                        type: changeType
                    };
                    event.setObject(entity);
                    events.push(event);
                    i++;
                    callback();
                }, (err) => {
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
                });
            });
        }, (err) => {
            this.sendConfirm(correlationId, this.downloadEventsMessageType, responseQueueName, requestId, err, blobIds, (err) => {
                timing.endTiming();
                callback(err);
            });
        });
    }
    uploadEvents(correlationId, blobIds, responseQueueName, requestId, callback) {
        var timing = this.instrument(correlationId, "uploadChanges", "from blobs " + blobIds + " to " + responseQueueName);
        var i = 0;
        async.whilst(() => i < blobIds.length, (callback) => {
            var blobId = blobIds[i];
            // Load data from the blob
            this._tempBlob.readBlobAsObject(correlationId, blobId, (err, data) => {
                if (err) {
                    callback(err);
                    return;
                }
                var j = 0;
                async.whilst(() => j < data.length, (callback) => {
                    var change = data[j];
                    var entity = change.getObject();
                    if (change.type == EventTypes_1.EventTypes.Created)
                        this.client.create(correlationId, entity, (err, entity) => {
                            j++;
                            callback(err);
                        });
                    else if (change.type == EventTypes_1.EventTypes.Updated)
                        this.client.update(correlationId, entity, (err, entity) => {
                            j++;
                            callback(err);
                        });
                    else if (change.type == EventTypes_1.EventTypes.Deleted) {
                        var entityId = pip_services3_commons_node_6.TypeConverter.toType(pip_services3_commons_node_7.TypeCode.Object, change.id);
                        this.client.deleteById(correlationId, entityId, (err, entity) => {
                            j++;
                            callback(err);
                        });
                    }
                }, (err) => {
                    i++;
                    callback(err);
                });
            });
        }, (err) => {
            this.sendConfirm(correlationId, this.uploadEventsMessageType, responseQueueName, requestId, err, blobIds, (err) => {
                timing.endTiming();
                callback(err);
            });
        });
    }
    sendConfirm(correlationId, messageType, responseQueueName, requestId, err, blobIds, callback) {
        var actionType = messageType == this.downloadEventsMessageType ? "Download" : "Upload";
        if (err)
            this._logger.error(correlationId, err, "Failed to %s entity events", actionType.toLowerCase());
        else
            this._logger.debug(correlationId, "%sed %s events into %s blobs", actionType, this.service, blobIds.length);
        // Send async confirmation
        if (responseQueueName != null) {
            let message = new RequestConfirmation_1.RequestConfirmation();
            message.request_id = requestId;
            message.correlation_id = correlationId;
            message.blob_ids = blobIds;
            message.successful = true;
            if (err) {
                message.successful = false;
                message.error = err.message;
            }
            var envelope = new pip_services3_messaging_node_1.MessageEnvelope(correlationId, messageType, JSON.stringify(message));
            var queue = this._references.getOneRequired(KnownDescriptors_1.KnownDescriptors.messageQueue(responseQueueName));
            queue.send(correlationId, envelope, (err1) => {
                if (err)
                    this._logger.trace(correlationId, "Sent %s events failure response", actionType.toLowerCase());
                else
                    this._logger.trace(correlationId, "Sent %s events confirmation", actionType.toLowerCase());
                callback(err);
            });
            return;
        }
        callback();
    }
}
exports.BatchEventsHelper = BatchEventsHelper;
//# sourceMappingURL=BatchEventsHelper.js.map