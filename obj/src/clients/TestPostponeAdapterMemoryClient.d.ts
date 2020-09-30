import { IReferences } from "pip-services3-commons-node";
import { Parameters } from "pip-services3-commons-node";
import { TestAdapterMemoryClient } from "./TestAdapterMemoryClient";
import { TestEntity } from "./TestEntity";
export declare class TestPostponeAdapterMemoryClient extends TestAdapterMemoryClient {
    postpone: boolean;
    constructor(entities: TestEntity[], references: IReferences, parameters?: Parameters);
    create(correlationId: string, entity: TestEntity, callback: (err: any, entity: TestEntity) => void): void;
}
