"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchesPollGenerator = void 0;
let async = require('async');
const ChangesPollGenerator_1 = require("./ChangesPollGenerator");
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const ChangesTransferParam_1 = require("../change_transfer/ChangesTransferParam");
class BatchesPollGenerator extends ChangesPollGenerator_1.ChangesPollGenerator {
    constructor(component, queue, references, parameters = null) {
        super(component, queue, references, BatchesPollGenerator._defaultParameters.override(parameters));
    }
    setParameters(parameters) {
        super.setParameters(parameters);
        this.BatchesPerRequest = this.parameters.getAsIntegerWithDefault(ChangesTransferParam_1.ChangesTransferParam.BatchesPerRequest, this.BatchesPerRequest);
    }
    execute(callback) {
        var polledEntities = 0;
        var startSyncTimeUtc;
        var endSyncTimeUtc;
        async.series([
            (callback) => {
                this.getStartSyncTimeUtc((err, date) => {
                    var _a;
                    var syncDelay = (_a = this.syncDelay) !== null && _a !== void 0 ? _a : 0;
                    startSyncTimeUtc = date;
                    endSyncTimeUtc = new Date(Date.now() - syncDelay);
                    callback(err);
                });
            },
            (callback) => {
                var _a;
                var pollAdapter = this.parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.PollAdapter);
                var filter = (_a = this.filter) !== null && _a !== void 0 ? _a : new pip_services3_commons_node_1.FilterParams();
                filter.setAsObject('FromDateTime', startSyncTimeUtc);
                filter.setAsObject('ToDateTime', endSyncTimeUtc);
                var maxPages = this.parameters.getAsIntegerWithDefault(ChangesTransferParam_1.ChangesTransferParam.RequestsPerInterval, -1);
                //this.LastSyncTimeUtc = new Date();
                var skip = 0;
                let cancel = false;
                async.whilst(() => !cancel, (callback) => {
                    let page;
                    async.series([
                        // Read changes from source
                        (callback) => {
                            pollAdapter.getBatches(this.correlationId, filter, new pip_services3_commons_node_1.PagingParams(skip, this.BatchesPerRequest, false), (err, data) => {
                                page = data;
                                let typename = pollAdapter.constructor.name;
                                this.logger.debug(this.correlationId, '%s retrieved %s batches changes from %s', this.name, page.data.length, typename);
                                callback(err);
                            });
                        },
                        // Process batches to each queue one by one
                        (callback) => {
                            async.each(page.data, (batch, callback) => {
                                async.series([
                                    // Send entities one-by-one to all destination queues
                                    (callback) => {
                                        var _a;
                                        var entities = (_a = batch.entities) !== null && _a !== void 0 ? _a : [];
                                        async.each(entities, (entity, callback) => {
                                            this._tempBlobClient.writeBlobConditional(this.correlationId, entity, null, (err, envelop) => {
                                                if (err) {
                                                    callback(err);
                                                    return;
                                                }
                                                this.queue.sendAsObject(this.correlationId, null, envelop, (err) => {
                                                    callback(err);
                                                });
                                            });
                                        }, (err) => {
                                            polledEntities++;
                                            callback(err);
                                        });
                                    },
                                    // If everything is ok, them ack the batch
                                    (callback) => {
                                        pollAdapter.ackBatchById(this.correlationId, batch.batch_id, callback);
                                    },
                                ], (err) => {
                                    callback(err);
                                });
                            }, (err) => {
                                callback(err);
                            });
                        },
                        // Exit when there is nothing to read
                        (callback) => {
                            var size = page.data.length;
                            maxPages--;
                            if (size == 0 || maxPages == 0) {
                                cancel = true;
                            }
                            skip += this.entitiesPerRequest;
                            callback();
                        },
                    ], (err) => {
                        callback(err);
                    });
                }, (err) => {
                    callback(err);
                });
            },
            (callback) => {
                // Update the last sync time
                this.lastSyncTimeUtc = endSyncTimeUtc;
                if (polledEntities > 0) {
                    this.logger.info(this.correlationId, '%s retrieved and sent %s changes', this.name, polledEntities);
                }
                else {
                    this.logger.info(this.correlationId, '%s found no changes', this.name, polledEntities);
                }
                if (this.statusSection != null) {
                    let updateParams = pip_services3_commons_node_1.ConfigParams.fromTuples('LastSyncTimeUtc', this.lastSyncTimeUtc);
                    let incrementParams = polledEntities > 0 ? pip_services3_commons_node_1.ConfigParams.fromTuples('PolledEntities', polledEntities) : null;
                    this._settingsClient.modifySection(this.correlationId, this.statusSection, updateParams, incrementParams, (err, parameters) => {
                        callback(err);
                    });
                }
            },
        ], (err) => {
            if (callback)
                callback(err);
        });
    }
}
exports.BatchesPollGenerator = BatchesPollGenerator;
BatchesPollGenerator._defaultParameters = pip_services3_commons_node_1.Parameters.fromTuples(ChangesTransferParam_1.ChangesTransferParam.BatchesPerRequest, 10);
//# sourceMappingURL=BatchesPollGenerator.js.map