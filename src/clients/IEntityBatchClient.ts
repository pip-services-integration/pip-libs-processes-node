import { DataPage, PagingParams, FilterParams } from 'pip-services3-commons-node';
import { EntityBatch } from '../data/EntityBatch';

export interface IEntityBatchClient<T> {
    getBatches(correlationId: string, filter: FilterParams, paging: PagingParams,
        callback: (err: any, page: DataPage<EntityBatch<T>>) => void);

    ackBatchById(correlationId: string, batchId: string,
        callback: (err: any) => void);
}