export class EntityBatch<T> {
    public batch_id: string;
    public entities: T[];

    public constructor(batchId: string = null, entities: T[] = null) {
        this.batch_id = batchId;
        this.entities = entities || [];
    }
}