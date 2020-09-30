const _ = require('lodash');
let async = require('async');

import { Parameters, IReferences, FilterParams, PagingParams, DataPage, ConfigParams } from 'pip-services3-commons-node';
import { MessageGenerator } from './MessageGenerator';
import { ChangesTransferParam } from '../change_transfer/ChangesTransferParam';
import { GeneratorParam } from './GeneratorParam';
import { IMessageQueue } from 'pip-services3-messaging-node';
import { ITempBlobsClientV1, DataEnvelopV1 } from 'pip-clients-tempblobs-node';
import { ISettingsClientV1 } from 'pip-clients-settings-node';
import { KnownDescriptors } from '../logic/KnownDescriptors';
import { IReadWriteClient } from '../clients/IReadWriteClient';


export class ChangesPollGenerator<T, K> extends MessageGenerator {
    protected static readonly _defaultParameters: Parameters = Parameters.fromTuples(
        ChangesTransferParam.EntitiesPerRequest, 100,
        GeneratorParam.MessageType, 'ChangeNotify',
        ChangesTransferParam.InitialSyncInterval, 24 * 60 * 60 * 1000, // 1 day
        ChangesTransferParam.SyncDelay, 5 * 60 * 1000 // 5 min
    );

    protected _settingsClient: ISettingsClientV1;
    protected _tempBlobClient: ITempBlobsClientV1;

    public entitiesPerRequest: number;
    public statusSection: string;
    public initialSyncInterval: number;
    public syncDelay: number;
    public filter: FilterParams;
    public lastSyncTimeUtc: Date;

    public constructor(component: string, queue: IMessageQueue,
        references: IReferences, parameters: Parameters = null) {
        super(component, 'Poll', queue, references, ChangesPollGenerator._defaultParameters.override(parameters));

        this.statusSection = this.component + '.Status';
    }

    setReferences(references: IReferences): void {
        super.setReferences(references);

        this._settingsClient = references.getOneRequired<ISettingsClientV1>(KnownDescriptors.Settings);
        this._tempBlobClient = references.getOneRequired<ITempBlobsClientV1>(KnownDescriptors.TempBlobs);
    }

    setParameters(parameters: Parameters): void {
        super.setParameters(parameters);

        // Define additional parameters
        this.messageType = this.parameters.getAsStringWithDefault(GeneratorParam.MessageType, this.messageType);

        this.entitiesPerRequest = this.parameters.getAsIntegerWithDefault(ChangesTransferParam.EntitiesPerRequest, this.entitiesPerRequest);
        this.initialSyncInterval = this.parameters.getAsIntegerWithDefault(ChangesTransferParam.InitialSyncInterval, this.initialSyncInterval);
        this.syncDelay = this.parameters.getAsIntegerWithDefault(ChangesTransferParam.SyncDelay, this.syncDelay);

        this.filter = this.getFilter();
    }

    protected getFilter(): FilterParams {
        var filter = this.parameters.get(ChangesTransferParam.Filter);

        if (filter == null) return null;

        if (_.isString(filter)) return FilterParams.fromString(filter.toString());

        return new FilterParams(filter);
    }

    protected getStartSyncTimeUtc(callback: (err: any, result: Date) => void) {
        // Read settings section
        if (this.statusSection == null)
            throw new Error('Settings section parameter is required');

        // Define default value
        var defaultStartTimeUtc = new Date(Date.now() - this.initialSyncInterval);

        // Read last sync time from status
        this._settingsClient.getSectionById(this.correlationId, this.statusSection, (err, settings) => {
            if (err) {
                if (callback) callback(err, null);
                return;
            }

            this.lastSyncTimeUtc = settings.getAsDateTimeWithDefault('LastSyncTimeUtc', defaultStartTimeUtc);

            // Double checking...
            if (this.lastSyncTimeUtc == null || this.lastSyncTimeUtc < defaultStartTimeUtc)
                this.lastSyncTimeUtc = defaultStartTimeUtc;

            if (callback) callback(null, this.lastSyncTimeUtc);
        });
    }

    public execute(callback: (err: any) => void): void {
        if (this.entitiesPerRequest <= 0) {
            if (callback) callback(null);
            return;
        }

        var startSyncTimeUtc: Date;
        var endSyncTimeUtc: Date;

        async.series([
            (callback) => {
                this.getStartSyncTimeUtc((err, date) => {
                    var syncDelay = this.syncDelay ?? 0;

                    startSyncTimeUtc = date;
                    endSyncTimeUtc = new Date(Date.now() - syncDelay);

                    callback(err);
                });
            },
            (callback) => {
                // Get references
                var pollAdapter = this.parameters.getAsObject(ChangesTransferParam.PollAdapter) as IReadWriteClient<T, K>;

                var filter = this.filter ?? new FilterParams();
                filter.setAsObject('FromDateTime', startSyncTimeUtc);
                filter.setAsObject('ToDateTime', endSyncTimeUtc);

                var maxPages = this.parameters.getAsIntegerWithDefault(ChangesTransferParam.RequestsPerInterval, -1);
                var polledEntities = 0;

                var skip = 0;
                var cancel = false;

                async.whilst(
                    () => !cancel,
                    (callback) => {
                        let page: DataPage<T>;

                        async.series([
                            (callback) => {
                                pollAdapter.getByFilter(this.correlationId, filter, new PagingParams(skip, this.entitiesPerRequest, false), (err, data) => {
                                    page = data;

                                    let typename = pollAdapter.constructor.name;
                                    this.logger.debug(this.correlationId, '%s retrieved %s changes from %s', this.name, page.data.length, typename);
                                    callback(err);
                                });
                            },
                            (callback) => {
                                async.each(page.data,
                                    (entity: T, callback) => {
                                        let envelop: DataEnvelopV1<T>;
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
                                    },
                                    (err) => {
                                        callback(err);
                                    }
                                );
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
                    },
                    (err) => {
                        // Update the last sync time
                        this.lastSyncTimeUtc = endSyncTimeUtc;

                        if (polledEntities > 0)
                            this.logger.info(this.correlationId, '%s retrieved and sent %s changes', this.name, polledEntities);
                        else
                            this.logger.info(this.correlationId, '%s found no changes', this.name, polledEntities);

                        if (this.statusSection != null) {
                            let updateParams = ConfigParams.fromTuples('LastSyncTimeUtc', this.lastSyncTimeUtc);
                            let incrementParams = polledEntities > 0 ? ConfigParams.fromTuples('PolledEntities', polledEntities) : null;

                            this._settingsClient.modifySection(this.correlationId, this.statusSection, updateParams, incrementParams, (err, parameters) => {
                                callback(err);
                            });
                        }
                        else {
                            callback(err);
                        }
                    }
                );
            },
        ], (err) => {
            callback(err);
        });
    }
}