export declare class EntityBatch<T> {
    batch_id: string;
    entities: T[];
    constructor(batchId?: string, entities?: T[]);
}
