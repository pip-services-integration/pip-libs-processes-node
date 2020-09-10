"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
        this.BatchesPerRequest = this.Parameters.getAsIntegerWithDefault(ChangesTransferParam_1.ChangesTransferParam.BatchesPerRequest, this.BatchesPerRequest);
    }
    execute(callback) {
        var polledEntities = 0;
        async.series([
            (callback) => {
                var _a;
                var pollAdapter = this.Parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.PollAdapter);
                var filter = (_a = this.Filter, (_a !== null && _a !== void 0 ? _a : new pip_services3_commons_node_1.FilterParams()));
                var maxPages = this.Parameters.getAsIntegerWithDefault(ChangesTransferParam_1.ChangesTransferParam.RequestsPerInterval, -1);
                this.LastSyncTimeUtc = new Date();
                let cancel = false;
                async.whilst(() => !cancel, (callback) => {
                    let page;
                    async.series([
                        // Read changes from source
                        (callback) => {
                            pollAdapter.getBatches(this.CorrelationId, filter, new pip_services3_commons_node_1.PagingParams(0, this.BatchesPerRequest, false), (err, data) => {
                                page = data;
                                let typename = pollAdapter.constructor.name;
                                this.Logger.debug(this.CorrelationId, '%s retrieved %s batches changes from %s', this.Name, page.data.length, typename);
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
                                        var entities = (_a = batch.entities, (_a !== null && _a !== void 0 ? _a : []));
                                        async.each(entities, (entity, callback) => {
                                            this._tempBlobClient.writeBlobConditional(this.CorrelationId, entity, null, (err, envelop) => {
                                                if (err) {
                                                    callback(err);
                                                    return;
                                                }
                                                this.Queue.sendAsObject(this.CorrelationId, null, envelop, (err) => {
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
                                        pollAdapter.ackBatchById(this.CorrelationId, batch.batch_id, callback);
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
                                callback();
                                return;
                            }
                        },
                    ], (err) => {
                        callback(err);
                    });
                }, (err) => {
                    callback(err);
                });
            },
            (callback) => {
                if (polledEntities > 0) {
                    this.Logger.info(this.CorrelationId, '{0} retrieved and sent {1} changes', this.Name, polledEntities);
                }
                else {
                    this.Logger.info(this.CorrelationId, '{0} found no changes', this.Name, polledEntities);
                }
                if (this.StatusSection != null) {
                    let updateParams = pip_services3_commons_node_1.ConfigParams.fromTuples('LastSyncTimeUtc', this.LastSyncTimeUtc);
                    let incrementParams = polledEntities > 0 ? pip_services3_commons_node_1.ConfigParams.fromTuples('PolledEntities', polledEntities) : null;
                    this._settingsClient.modifySection(this.CorrelationId, this.StatusSection, updateParams, incrementParams, (err, parameters) => {
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