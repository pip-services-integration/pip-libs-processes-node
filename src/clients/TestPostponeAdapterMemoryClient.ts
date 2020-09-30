
import { IReferences } from "pip-services3-commons-node";
import { Parameters } from "pip-services3-commons-node";
import { TestAdapterMemoryClient } from "./TestAdapterMemoryClient";
import { TestEntity } from "./TestEntity";
import { EntityPostponeException } from "../data/EntityPostponeException";

export class TestPostponeAdapterMemoryClient extends TestAdapterMemoryClient {
    public postpone: boolean;

    constructor(entities: TestEntity[], references: IReferences, parameters: Parameters = null) {
        super(entities, references, parameters);
    }

    public create(correlationId: string, entity: TestEntity, callback: (err: any, entity: TestEntity) => void): void {
        if (this.postpone) {
            callback(new EntityPostponeException(entity.id, "Entity was postponed"), entity);
            return;
        }

        super.create(correlationId, entity, callback);
    }
}
