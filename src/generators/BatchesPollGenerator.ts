let async = require('async');

import { ChangesPollGenerator } from './ChangesPollGenerator';
import { Parameters, IReferences, FilterParams, DataPage, PagingParams, ConfigParams } from 'pip-services3-commons-node';
import { ChangesTransferParam } from '../change_transfer/ChangesTransferParam';
import { IMessageQueue } from 'pip-services3-messaging-node';
import { IEntityBatchClient } from '../clients/IEntityBatchClient';
import { EntityBatch } from '../data/EntityBatch';

export class BatchesPollGenerator<T, K> extends ChangesPollGenerator<T, K> {
    protected static readonly _defaultParameters: Parameters = Parameters.fromTuples(
        ChangesTransferParam.BatchesPerRequest, 10
    );

    public BatchesPerRequest: number;

    public constructor(component: string, queue: IMessageQueue,
        references: IReferences, parameters: Parameters = null) {
        super(component, queue, references, BatchesPollGenerator._defaultParameters.override(parameters));
    }

    public setParameters(parameters: Parameters) {
        super.setParameters(parameters);

        this.BatchesPerRequest = this.parameters.getAsIntegerWithDefault(ChangesTransferParam.BatchesPerRequest, this.BatchesPerRequest);
    }

    public execute(callback: (err: any) => void): void {
        var polledEntities = 0;

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
                var pollAdapter = this.parameters.getAsObject(ChangesTransferParam.PollAdapter) as IEntityBatchClient<T>;

                var filter = this.filter ?? new FilterParams();
                filter.setAsObject('FromDateTime', startSyncTimeUtc);
                filter.setAsObject('ToDateTime', endSyncTimeUtc);

                var maxPages = this.parameters.getAsIntegerWithDefault(ChangesTransferParam.RequestsPerInterval, -1);
                //this.LastSyncTimeUtc = new Date();

                var skip = 0;
                let cancel = false;

                async.whilst(
                    () => !cancel,
                    (callback) => {
                        let page: DataPage<EntityBatch<T>>;
                        async.series([
                            // Read changes from source
                            (callback) => {
                                pollAdapter.getBatches(this.correlationId, filter, new PagingParams(skip, this.BatchesPerRequest, false), (err, data) => {
                                    page = data;

                                    let typename = pollAdapter.constructor.name;
                                    this.logger.debug(this.correlationId, '%s retrieved %s batches changes from %s', this.name, page.data.length, typename);
                                    callback(err);
                                });
                            },
                            // Process batches to each queue one by one
                            (callback) => {
                                async.each(page.data,
                                    (batch: EntityBatch<T>, callback) => {
                                        async.series([
                                            // Send entities one-by-one to all destination queues
                                            (callback) => {
                                                var entities = batch.entities ?? [];
                                                async.each(entities,
                                                    (entity, callback) => {
                                                        this._tempBlobClient.writeBlobConditional<T>(this.correlationId, entity, null, (err, envelop) => {
                                                            if (err) {
                                                                callback(err);
                                                                return;
                                                            }

                                                            this.queue.sendAsObject(this.correlationId, null, envelop, (err) => {
                                                                callback(err);
                                                            });
                                                        });
                                                    },
                                                    (err) => {
                                                        polledEntities++;
                                                        callback(err);
                                                    }
                                                );
                                            },
                                            // If everything is ok, them ack the batch
                                            (callback) => {
                                                pollAdapter.ackBatchById(this.correlationId, batch.batch_id, callback);
                                            },
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
                        callback(err);
                    }
                );
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
                    let updateParams = ConfigParams.fromTuples('LastSyncTimeUtc', this.lastSyncTimeUtc);
                    let incrementParams = polledEntities > 0 ? ConfigParams.fromTuples('PolledEntities', polledEntities) : null;

                    this._settingsClient.modifySection(this.correlationId, this.statusSection, updateParams, incrementParams, (err, parameters) => {
                        callback(err);
                    });
                }
            },
        ], (err) => {
            if (callback) callback(err);
        });
    }
}