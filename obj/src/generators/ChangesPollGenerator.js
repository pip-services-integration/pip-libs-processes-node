"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let async = require('async');
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const MessageGenerator_1 = require("./MessageGenerator");
const ChangesTransferParam_1 = require("../change_transfer/ChangesTransferParam");
const GeneratorParam_1 = require("./GeneratorParam");
const KnownDescriptors_1 = require("../logic/KnownDescriptors");
const util_1 = require("util");
class ChangesPollGenerator extends MessageGenerator_1.MessageGenerator {
    constructor(component, queue, references, parameters = null) {
        super(component, 'Poll', queue, references, ChangesPollGenerator._defaultParameters.override(parameters));
        this.StatusSection = this.Component + '.Status';
    }
    setReferences(references) {
        super.setReferences(references);
        this._settingsClient = references.getOneRequired(KnownDescriptors_1.KnownDescriptors.Settings);
        this._tempBlobClient = references.getOneRequired(KnownDescriptors_1.KnownDescriptors.TempBlobs);
    }
    setParameters(parameters) {
        super.setParameters(parameters);
        // Define additional parameters
        this.MessageType = this.Parameters.getAsStringWithDefault(GeneratorParam_1.GeneratorParam.MessageType, this.MessageType);
        this.EntitiesPerRequest = this.Parameters.getAsIntegerWithDefault(ChangesTransferParam_1.ChangesTransferParam.EntitiesPerRequest, this.EntitiesPerRequest);
        this.InitialSyncInterval = this.Parameters.getAsIntegerWithDefault(ChangesTransferParam_1.ChangesTransferParam.InitialSyncInterval, this.InitialSyncInterval);
        this.SyncDelay = this.Parameters.getAsIntegerWithDefault(ChangesTransferParam_1.ChangesTransferParam.SyncDelay, this.SyncDelay);
        this.Filter = this.getFilter();
    }
    getFilter() {
        var filter = this.Parameters.get(ChangesTransferParam_1.ChangesTransferParam.Filter);
        if (filter == null)
            return null;
        if (util_1.isString(filter))
            return pip_services3_commons_node_1.FilterParams.fromString(filter.toString());
        return new pip_services3_commons_node_1.FilterParams(filter);
    }
    getStartSyncTimeUtcAsync(callback) {
        // Read settings section
        if (this.StatusSection == null)
            throw new Error('Settings section parameter is required');
        // Define default value
        var defaultStartTimeUtc = new Date(Date.now() - this.InitialSyncInterval);
        // Read last sync time from status
        this._settingsClient.getSectionById(this.CorrelationId, this.StatusSection, (err, settings) => {
            if (err) {
                if (callback)
                    callback(err, null);
                return;
            }
            this.LastSyncTimeUtc = settings.getAsDateTimeWithDefault('LastSyncTimeUtc', defaultStartTimeUtc);
            // Double checking...
            if (this.LastSyncTimeUtc == null || this.LastSyncTimeUtc < defaultStartTimeUtc)
                this.LastSyncTimeUtc = defaultStartTimeUtc;
            if (callback)
                callback(null, this.LastSyncTimeUtc);
        });
    }
    execute(callback) {
        if (this.EntitiesPerRequest <= 0) {
            if (callback)
                callback(null);
            return;
        }
        var startSyncTimeUtc;
        var endSyncTimeUtc;
        async.series([
            (callback) => {
                this.getStartSyncTimeUtcAsync((err, date) => {
                    startSyncTimeUtc = date;
                    endSyncTimeUtc = new Date(Date.now() - this.SyncDelay);
                    callback(err);
                });
            },
            (callback) => {
                var _a;
                // Get references
                var pollAdapter = this.Parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.PollAdapter);
                var filter = (_a = this.Filter, (_a !== null && _a !== void 0 ? _a : new pip_services3_commons_node_1.FilterParams()));
                filter.setAsObject('FromDateTime', startSyncTimeUtc);
                filter.setAsObject('ToDateTime', endSyncTimeUtc);
                var maxPages = this.Parameters.getAsIntegerWithDefault(ChangesTransferParam_1.ChangesTransferParam.RequestsPerInterval, -1);
                var polledEntities = 0;
                var skip = 0;
                var cancel = false;
                async.whilst(() => !cancel, (callback) => {
                    let page;
                    async.series([
                        (callback) => {
                            pollAdapter.getByFilter(this.CorrelationId, filter, new pip_services3_commons_node_1.PagingParams(skip, this.EntitiesPerRequest, false), (err, data) => {
                                page = data;
                                let typename = pollAdapter.constructor.name;
                                this.Logger.debug(this.CorrelationId, '%s retrieved %s changes from %s', this.Name, page.data.length, typename);
                                callback(err);
                            });
                        },
                        (callback) => {
                            async.each(page.data, (entity, callback) => {
                                let envelop;
                                async.series([
                                    (callback) => {
                                        this._tempBlobClient.writeBlobConditional(this.CorrelationId, entity, null, (err, data) => {
                                            envelop = data;
                                            callback(err);
                                        });
                                    },
                                    (callback) => {
                                        this.Queue.sendAsObject(this.CorrelationId, null, envelop, (err) => {
                                            if (err) {
                                                callback(err);
                                                return;
                                            }
                                            polledEntities++;
                                            callback();
                                        });
                                    }
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
                            skip += this.EntitiesPerRequest;
                        },
                    ], (err) => {
                        callback(err);
                    });
                }, (err) => {
                    // Update the last sync time
                    this.LastSyncTimeUtc = endSyncTimeUtc;
                    if (polledEntities > 0)
                        this.Logger.info(this.CorrelationId, '%s retrieved and sent %s changes', this.Name, polledEntities);
                    else
                        this.Logger.info(this.CorrelationId, '%s found no changes', this.Name, polledEntities);
                    if (this.StatusSection != null) {
                        let updateParams = pip_services3_commons_node_1.ConfigParams.fromTuples('LastSyncTimeUtc', this.LastSyncTimeUtc);
                        let incrementParams = polledEntities > 0 ? pip_services3_commons_node_1.ConfigParams.fromTuples('PolledEntities', polledEntities) : null;
                        this._settingsClient.modifySection(this.CorrelationId, this.StatusSection, updateParams, incrementParams, (err, parameters) => {
                            callback(err);
                        });
                    }
                    else {
                        callback(err);
                    }
                });
            },
        ], (err) => {
            callback(err);
        });
    }
}
exports.ChangesPollGenerator = ChangesPollGenerator;
ChangesPollGenerator._defaultParameters = pip_services3_commons_node_1.Parameters.fromTuples(ChangesTransferParam_1.ChangesTransferParam.EntitiesPerRequest, 100, GeneratorParam_1.GeneratorParam.MessageType, 'ChangeNotify', ChangesTransferParam_1.ChangesTransferParam.InitialSyncInterval, 24 * 60 * 60 * 1000, // 1 day
ChangesTransferParam_1.ChangesTransferParam.SyncDelay, 5 * 60 * 1000 // 5 min
);
//# sourceMappingURL=ChangesPollGenerator.js.map