let async = require('async');

import { ChangesPollGenerator } from './ChangesPollGenerator';
import { Parameters, IReferences, FilterParams, DataPage, PagingParams, ConfigParams } from 'pip-services3-commons-node';
import { ChangesTransferParam } from '../change_transfer/ChangesTransferParam';
import { IMessageQueue, MessageEnvelope } from 'pip-services3-messaging-node';
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

        this.BatchesPerRequest = this.Parameters.getAsIntegerWithDefault(ChangesTransferParam.BatchesPerRequest, this.BatchesPerRequest);
    }

    public execute(callback: (err: any) => void): void {
        var polledEntities = 0;

        async.series([
            (callback) => {
                var pollAdapter = this.Parameters.getAsObject(ChangesTransferParam.PollAdapter) as IEntityBatchClient<T>;

                var filter = this.Filter ?? new FilterParams();

                var maxPages = this.Parameters.getAsIntegerWithDefault(ChangesTransferParam.RequestsPerInterval, -1);
                this.LastSyncTimeUtc = new Date();

                let cancel = false;

                async.whilst(
                    () => !cancel,
                    (callback) => {
                        let page: DataPage<EntityBatch<T>>;
                        async.series([
                            // Read changes from source
                            (callback) => {
                                pollAdapter.getBatches(this.CorrelationId, filter, new PagingParams(0, this.BatchesPerRequest, false), (err, data) => {
                                    page = data;

                                    let typename = pollAdapter.constructor.name;
                                    this.Logger.debug(this.CorrelationId, '%s retrieved %s batches changes from %s', this.Name, page.data.length, typename);
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
                                                        this._tempBlobClient.writeBlobConditional<T>(this.CorrelationId, entity, null, (err, envelop) => {
                                                            if (err) {
                                                                callback(err);
                                                                return;
                                                            }

                                                            this.Queue.sendAsObject(this.CorrelationId, null, envelop, (err) => {
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
                                                pollAdapter.ackBatchById(this.CorrelationId, batch.batch_id, callback);
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
                                    callback();
                                    return;
                                }
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
                if (polledEntities > 0) {
                    this.Logger.info(this.CorrelationId, '{0} retrieved and sent {1} changes', this.Name, polledEntities);
                }
                else {
                    this.Logger.info(this.CorrelationId, '{0} found no changes', this.Name, polledEntities);
                }

                if (this.StatusSection != null) {
                    let updateParams = ConfigParams.fromTuples('LastSyncTimeUtc', this.LastSyncTimeUtc);
                    let incrementParams = polledEntities > 0 ? ConfigParams.fromTuples('PolledEntities', polledEntities) : null;

                    this._settingsClient.modifySection(this.CorrelationId, this.StatusSection, updateParams, incrementParams, (err, parameters) => {
                        callback(err);
                    });
                }
            },
        ], (err) => {
            if (callback) callback(err);
        });
    }
}