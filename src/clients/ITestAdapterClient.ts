import { ICapableClient } from './ICapableClient';
import { IReadWriteClient } from './IReadWriteClient';
import { IBatchAllClient } from './IBatchAllClient';
import { IBatchChangesClient } from './IBatchChangesClient';
import { TestEntity } from './TestEntity';

export interface ITestAdapterClient
    extends ICapableClient, IReadWriteClient<TestEntity, string>,
            IBatchAllClient<TestEntity>, IBatchChangesClient<TestEntity> {
}
