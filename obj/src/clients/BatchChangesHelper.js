"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let async = require('async');
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const ClientParam_1 = require("./ClientParam");
const pip_services3_commons_node_2 = require("pip-services3-commons-node");
const pip_services3_components_node_1 = require("pip-services3-components-node");
const pip_services3_commons_node_3 = require("pip-services3-commons-node");
const ChangeType_1 = require("../data/ChangeType");
const data_1 = require("../data");
const logic_1 = require("../logic");
class BatchChangesHelper {
    constructor(adapter, service, client, references, parameters) {
        this._logger = new pip_services3_components_node_1.CompositeLogger();
        this._counters = new pip_services3_components_node_1.CompositeCounters();
        this._tempBlob = null;
        if (adapter == null)
            throw new pip_services3_commons_node_3.ApplicationException("Adapter cannot be null");
        if (service == null)
            throw new pip_services3_commons_node_3.ApplicationException("Service cannot be null");
        if (client == null)
            throw new pip_services3_commons_node_3.ApplicationException("Client cannot be null");
        this.adapter = adapter;
        this.service = service;
        this.client = client;
        this.setParameters(BatchChangesHelper._defaultParameters.override(parameters));
        if (references != null)
            this.setReferences(references);
    }
    setReferences(references) {
        this._references = references;
        this._logger.setReferences(references);
        this._counters.setReferences(references);
        this._tempBlob = references.getOneOptional(logic_1.KnownDescriptors.TempBlobs);
    }
    setParameters(parameters) {
        this.pageSize = parameters.getAsIntegerWithDefault(ClientParam_1.ClientParam.PageSize, this.pageSize);
        this.entitiesPerBlob = parameters.getAsIntegerWithDefault(ClientParam_1.ClientParam.EntitiesPerBlob, this.entitiesPerBlob);
        this.blobTimeToLive = parameters.getAsLongWithDefault(ClientParam_1.ClientParam.BlobTimeToLive, this.blobTimeToLive);
        this.correlationId = parameters.getAsStringWithDefault(ClientParam_1.ClientParam.CorrelationId, this.correlationId);
        this.downloadChangesMessageType = parameters.getAsStringWithDefault(ClientParam_1.ClientParam.DownloadChangesMessageType, this.downloadChangesMessageType);
        this.uploadChangesMessageType = parameters.getAsStringWithDefault(ClientParam_1.ClientParam.UploadChangesMessageType, this.uploadChangesMessageType);
    }
    instrument(correlationId, methodName, message = "") {
        this._logger.trace((correlationId !== null && correlationId !== void 0 ? correlationId : this.correlationId), "Called {0}.{1}.{2} {3}", this.adapter, this.service, methodName, message);
        return this._counters.beginTiming(this.adapter + "." + this.service + "." + methodName + ".call_time");
    }
    handleError(correlationId, methodName, error) {
        this._logger.error((correlationId !== null && correlationId !== void 0 ? correlationId : this.correlationId), error, "Failed to call {0}.{1}.{2}", this.adapter, this.service, methodName);
        return error;
    }
    downloadAll(correlationId, responseQueueName, requestId, callback) {
        this.downloadChanges(correlationId, null, null, null, responseQueueName, requestId, callback);
    }
    uploadAll(correlationId, blobIds, responseQueueName, requestId, callback) {
        this.uploadChanges(correlationId, blobIds, responseQueueName, requestId, callback);
    }
    isChangeable(obj) {
        let changeable = obj;
        return changeable.deleted !== undefined;
    }
    isIdentifiable(obj) {
        let identifiable = obj;
        return identifiable.id !== undefined;
    }
    downloadChanges(correlationId, filter, fromTime, toTime, responseQueueName, requestId, callback) {
        filter = (filter !== null && filter !== void 0 ? filter : new pip_services3_commons_node_1.FilterParams());
        var timing = this.instrument(correlationId, "downloadChanges", "with filter " + filter.toString() +
            " from " + pip_services3_commons_node_1.StringConverter.toString(fromTime) + " to " + responseQueueName);
        var blobIds = [];
        var chunk = [];
        var skip = 0;
        async.whilst(() => chunk.length < this.pageSize || chunk.length == 0, (callback) => {
            // Get a chunk
            var paging = new pip_services3_commons_node_1.PagingParams(skip, this.entitiesPerBlob, false);
            this.client.getByFilter(correlationId, filter, paging, (err, page) => {
                var _a;
                if (err) {
                    callback(err);
                    return;
                }
                chunk = (_a = page.data, (_a !== null && _a !== void 0 ? _a : []));
                skip += chunk.length;
                var changes = [];
                var now = new Date(Date.now());
                var i = 0;
                async.whilst(() => i < chunk.length, (callback) => {
                    let entity = chunk[i];
                    let changeType = ChangeType_1.ChangeType.Updated;
                    let changeTime = now;
                    let id = null;
                    if (this.isChangeable(entity)) {
                        if (entity.deleted)
                            changeType = ChangeType_1.ChangeType.Deleted;
                        if (entity.create_time == entity.change_time)
                            changeType = ChangeType_1.ChangeType.Created;
                        changeTime = entity.change_time;
                    }
                    // Clarify entity id
                    if (this.isIdentifiable(entity)) {
                        let identifiable = entity;
                        id = identifiable.id.toString();
                    }
                    let change = {
                        change_time: changeTime,
                        data: entity,
                        id: id,
                        change_type: changeType
                    };
                    changes.push(change);
                    i++;
                    callback();
                }, (err) => {
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
                });
            });
        }, (err) => {
            if (err) {
                this._logger.error(correlationId, err, "Failed to download entity changes");
                // Send async fail confirmation
                if (responseQueueName != null) {
                    let message = new data_1.RequestConfirmation();
                    message.request_id = requestId;
                    message.correlation_id = correlationId;
                    message.blob_ids = blobIds;
                    message.successful = false;
                    message.error = err.message;
                    var queue = this._references.getOneRequired(logic_1.KnownDescriptors.messageQueue(responseQueueName));
                    queue.sendAsObject(correlationId, this.downloadChangesMessageType, message, (err) => {
                        this._logger.trace(correlationId, "Sent download changes failure response");
                    });
                }
            }
            timing.endTiming();
            callback(err);
        });
    }
    uploadChanges(correlationId, blobIds, responseQueueName, requestId, callback) {
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
                    if (change.change_type == ChangeType_1.ChangeType.Created)
                        this.client.create(correlationId, change.data, (err, entity) => {
                            j++;
                            callback(err);
                        });
                    else if (change.change_type == ChangeType_1.ChangeType.Updated)
                        this.client.update(correlationId, change.data, (err, entity) => {
                            j++;
                            callback(err);
                        });
                    else if (change.change_type == ChangeType_1.ChangeType.Deleted) {
                        var entityId = pip_services3_commons_node_1.TypeConverter.toType(pip_services3_commons_node_1.TypeCode.Object, change.id);
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
            if (err) {
                this._logger.debug(correlationId, "Uploaded {0} changes from {1} blobs", this.service, blobIds.length);
                // Send async confirmation
                if (responseQueueName != null) {
                    var message = new data_1.RequestConfirmation();
                    message.request_id = requestId;
                    message.correlation_id = correlationId;
                    message.blob_ids = blobIds;
                    message.successful = true;
                    var queue = this._references.getOneRequired(logic_1.KnownDescriptors.messageQueue(responseQueueName));
                    queue.sendAsObject(correlationId, this.uploadChangesMessageType, message, (err) => {
                        this._logger.trace(correlationId, "Send upload changes confirmation");
                    });
                }
            }
            timing.endTiming();
            callback(err);
        });
    }
}
exports.BatchChangesHelper = BatchChangesHelper;
BatchChangesHelper._defaultParameters = pip_services3_commons_node_2.Parameters.fromTuples(ClientParam_1.ClientParam.PageSize, 100, ClientParam_1.ClientParam.EntitiesPerBlob, 100, ClientParam_1.ClientParam.BlobTimeToLive, 24 * 60 * 60 * 1000, // 1 day
ClientParam_1.ClientParam.DownloadChangesMessageType, "DownloadChangesResponse", ClientParam_1.ClientParam.UploadChangesMessageType, "UploadChnagesResponse");
//# sourceMappingURL=BatchChangesHelper.js.map