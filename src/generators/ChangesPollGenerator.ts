let async = require('async');

import { Parameters, IReferences, FilterParams, PagingParams, DataPage, ConfigParams } from 'pip-services3-commons-node';
import { MessageGenerator } from './MessageGenerator';
import { ChangesTransferParam } from '../change_transfer/ChangesTransferParam';
import { GeneratorParam } from './GeneratorParam';
import { IMessageQueue } from 'pip-services3-messaging-node';
import { ITempBlobsClientV1, DataEnvelopV1 } from 'pip-clients-tempblobs-node';
import { ISettingsClientV1 } from 'pip-clients-settings-node';
import { KnownDescriptors } from '../logic/KnownDescriptors';
import { isString } from 'util';
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

    public EntitiesPerRequest: number;
    public StatusSection: string;
    public InitialSyncInterval: number;
    public SyncDelay: number;
    public Filter: FilterParams;
    public LastSyncTimeUtc: Date;

    public constructor(component: string, queue: IMessageQueue,
        references: IReferences, parameters: Parameters = null) {
        super(component, 'Poll', queue, references, ChangesPollGenerator._defaultParameters.override(parameters));

        this.StatusSection = this.Component + '.Status';
    }

    setReferences(references: IReferences): void {
        super.setReferences(references);

        this._settingsClient = references.getOneRequired<ISettingsClientV1>(KnownDescriptors.Settings);
        this._tempBlobClient = references.getOneRequired<ITempBlobsClientV1>(KnownDescriptors.TempBlobs);
    }

    setParameters(parameters: Parameters): void {
        super.setParameters(parameters);

        // Define additional parameters
        this.MessageType = this.Parameters.getAsStringWithDefault(GeneratorParam.MessageType, this.MessageType);

        this.EntitiesPerRequest = this.Parameters.getAsIntegerWithDefault(ChangesTransferParam.EntitiesPerRequest, this.EntitiesPerRequest);
        this.InitialSyncInterval = this.Parameters.getAsIntegerWithDefault(ChangesTransferParam.InitialSyncInterval, this.InitialSyncInterval);
        this.SyncDelay = this.Parameters.getAsIntegerWithDefault(ChangesTransferParam.SyncDelay, this.SyncDelay);

        this.Filter = this.getFilter();
    }

    protected getFilter(): FilterParams {
        var filter = this.Parameters.get(ChangesTransferParam.Filter);

        if (filter == null) return null;

        if (isString(filter)) return FilterParams.fromString(filter.toString());

        return new FilterParams(filter);
    }

    protected getStartSyncTimeUtcAsync(callback: (err: any, result: Date) => void) {
        // Read settings section
        if (this.StatusSection == null)
            throw new Error('Settings section parameter is required');

        // Define default value
        var defaultStartTimeUtc = new Date(Date.now() - this.InitialSyncInterval);

        // Read last sync time from status
        this._settingsClient.getSectionById(this.CorrelationId, this.StatusSection, (err, settings) => {
            if (err) {
                if (callback) callback(err, null);
                return;
            }

            this.LastSyncTimeUtc = settings.getAsDateTimeWithDefault('LastSyncTimeUtc', defaultStartTimeUtc);

            // Double checking...
            if (this.LastSyncTimeUtc == null || this.LastSyncTimeUtc < defaultStartTimeUtc)
                this.LastSyncTimeUtc = defaultStartTimeUtc;

            if (callback) callback(null, this.LastSyncTimeUtc);
        });
    }

    public execute(callback: (err: any) => void): void {
        if (this.EntitiesPerRequest <= 0) {
            if (callback) callback(null);
            return;
        }

        var startSyncTimeUtc: Date;
        var endSyncTimeUtc: Date;

        async.series([
            (callback) => {
                this.getStartSyncTimeUtcAsync((err, date) => {
                    startSyncTimeUtc = date;
                    endSyncTimeUtc = new Date(Date.now() - this.SyncDelay);

                    callback(err);
                });
            },
            (callback) => {
                // Get references
                var pollAdapter = this.Parameters.getAsObject(ChangesTransferParam.PollAdapter) as IReadWriteClient<T, K>;

                var filter = this.Filter ?? new FilterParams();
                filter.setAsObject('FromDateTime', startSyncTimeUtc);
                filter.setAsObject('ToDateTime', endSyncTimeUtc);

                var maxPages = this.Parameters.getAsIntegerWithDefault(ChangesTransferParam.RequestsPerInterval, -1);
                var polledEntities = 0;

                var skip = 0;
                var cancel = false;

                async.whilst(
                    () => !cancel,
                    (callback) => {
                        let page: DataPage<T>;

                        async.series([
                            (callback) => {
                                pollAdapter.getByFilter(this.CorrelationId, filter, new PagingParams(skip, this.EntitiesPerRequest, false), (err, data) => {
                                    page = data;

                                    let typename = pollAdapter.constructor.name;
                                    this.Logger.debug(this.CorrelationId, '%s retrieved %s changes from %s', this.Name, page.data.length, typename);
                                    callback(err);
                                });
                            },
                            (callback) => {
                                async.each(page.data,
                                    (entity: T, callback) => {
                                        let envelop: DataEnvelopV1<T>;
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
                                    callback();
                                    return;
                                }

                                skip += this.EntitiesPerRequest;
                            },
                        ], (err) => {
                            callback(err);
                        });
                    },
                    (err) => {
                        // Update the last sync time
                        this.LastSyncTimeUtc = endSyncTimeUtc;

                        if (polledEntities > 0)
                            this.Logger.info(this.CorrelationId, '%s retrieved and sent %s changes', this.Name, polledEntities);
                        else
                            this.Logger.info(this.CorrelationId, '%s found no changes', this.Name, polledEntities);

                        if (this.StatusSection != null) {
                            let updateParams = ConfigParams.fromTuples('LastSyncTimeUtc', this.LastSyncTimeUtc);
                            let incrementParams = polledEntities > 0 ? ConfigParams.fromTuples('PolledEntities', polledEntities) : null;

                            this._settingsClient.modifySection(this.CorrelationId, this.StatusSection, updateParams, incrementParams, (err, parameters) => {
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