"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangesPollGenerator = void 0;
const _ = require('lodash');
let async = require('async');
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const MessageGenerator_1 = require("./MessageGenerator");
const ChangesTransferParam_1 = require("../change_transfer/ChangesTransferParam");
const GeneratorParam_1 = require("./GeneratorParam");
const KnownDescriptors_1 = require("../logic/KnownDescriptors");
class ChangesPollGenerator extends MessageGenerator_1.MessageGenerator {
    constructor(component, queue, references, parameters = null) {
        super(component, 'Poll', queue, references, ChangesPollGenerator._defaultParameters.override(parameters));
        this.statusSection = this.component + '.Status';
    }
    setReferences(references) {
        super.setReferences(references);
        this._settingsClient = references.getOneRequired(KnownDescriptors_1.KnownDescriptors.Settings);
        this._tempBlobClient = references.getOneRequired(KnownDescriptors_1.KnownDescriptors.TempBlobs);
    }
    setParameters(parameters) {
        super.setParameters(parameters);
        // Define additional parameters
        this.messageType = this.parameters.getAsStringWithDefault(GeneratorParam_1.GeneratorParam.MessageType, this.messageType);
        this.entitiesPerRequest = this.parameters.getAsIntegerWithDefault(ChangesTransferParam_1.ChangesTransferParam.EntitiesPerRequest, this.entitiesPerRequest);
        this.initialSyncInterval = this.parameters.getAsIntegerWithDefault(ChangesTransferParam_1.ChangesTransferParam.InitialSyncInterval, this.initialSyncInterval);
        this.syncDelay = this.parameters.getAsIntegerWithDefault(ChangesTransferParam_1.ChangesTransferParam.SyncDelay, this.syncDelay);
        this.filter = this.getFilter();
    }
    getFilter() {
        var filter = this.parameters.get(ChangesTransferParam_1.ChangesTransferParam.Filter);
        if (filter == null)
            return null;
        if (_.isString(filter))
            return pip_services3_commons_node_1.FilterParams.fromString(filter.toString());
        return new pip_services3_commons_node_1.FilterParams(filter);
    }
    getStartSyncTimeUtc(callback) {
        // Read settings section
        if (this.statusSection == null)
            throw new Error('Settings section parameter is required');
        // Define default value
        var defaultStartTimeUtc = new Date(Date.now() - this.initialSyncInterval);
        // Read last sync time from status
        this._settingsClient.getSectionById(this.correlationId, this.statusSection, (err, settings) => {
            if (err) {
                if (callback)
                    callback(err, null);
                return;
            }
            this.lastSyncTimeUtc = settings.getAsDateTimeWithDefault('LastSyncTimeUtc', defaultStartTimeUtc);
            // Double checking...
            if (this.lastSyncTimeUtc == null || this.lastSyncTimeUtc < defaultStartTimeUtc)
                this.lastSyncTimeUtc = defaultStartTimeUtc;
            if (callback)
                callback(null, this.lastSyncTimeUtc);
        });
    }
    execute(callback) {
        if (this.entitiesPerRequest <= 0) {
            if (callback)
                callback(null);
            return;
        }
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
                // Get references
                var pollAdapter = this.parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.PollAdapter);
                var filter = (_a = this.filter) !== null && _a !== void 0 ? _a : new pip_services3_commons_node_1.FilterParams();
                filter.setAsObject('FromDateTime', startSyncTimeUtc);
                filter.setAsObject('ToDateTime', endSyncTimeUtc);
                var maxPages = this.parameters.getAsIntegerWithDefault(ChangesTransferParam_1.ChangesTransferParam.RequestsPerInterval, -1);
                var polledEntities = 0;
                var skip = 0;
                var cancel = false;
                async.whilst(() => !cancel, (callback) => {
                    let page;
                    async.series([
                        (callback) => {
                            pollAdapter.getByFilter(this.correlationId, filter, new pip_services3_commons_node_1.PagingParams(skip, this.entitiesPerRequest, false), (err, data) => {
                                page = data;
                                let typename = pollAdapter.constructor.name;
                                this.logger.debug(this.correlationId, '%s retrieved %s changes from %s', this.name, page.data.length, typename);
                                callback(err);
                            });
                        },
                        (callback) => {
                            async.each(page.data, (entity, callback) => {
                                let envelop;
                                async.series([
                                    (callback) => {
                                        this._tempBlobClient.writeBlobConditional(this.correlationId, entity, null, (err, data) => {
                                            envelop = data;
                                            callback(err);
                                        });
                                    },
                                    (callback) => {
                                        this.queue.sendAsObject(this.correlationId, null, envelop, (err) => {
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
                            }
                            skip += this.entitiesPerRequest;
                            callback();
                        },
                    ], (err) => {
                        callback(err);
                    });
                }, (err) => {
                    // Update the last sync time
                    this.lastSyncTimeUtc = endSyncTimeUtc;
                    if (polledEntities > 0)
                        this.logger.info(this.correlationId, '%s retrieved and sent %s changes', this.name, polledEntities);
                    else
                        this.logger.info(this.correlationId, '%s found no changes', this.name, polledEntities);
                    if (this.statusSection != null) {
                        let updateParams = pip_services3_commons_node_1.ConfigParams.fromTuples('LastSyncTimeUtc', this.lastSyncTimeUtc);
                        let incrementParams = polledEntities > 0 ? pip_services3_commons_node_1.ConfigParams.fromTuples('PolledEntities', polledEntities) : null;
                        this._settingsClient.modifySection(this.correlationId, this.statusSection, updateParams, incrementParams, (err, parameters) => {
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