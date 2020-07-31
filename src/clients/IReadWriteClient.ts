import { DataPage } from "pip-services3-commons-node";
import { FilterParams } from "pip-services3-commons-node";
import { PagingParams } from "pip-services3-commons-node";

export interface IReadWriteClient<T, K> {
    /**
     * Gets a page with entities for a given filter and paging parameters
     * @param correlationId A unique process or correlation id
     * @param filter Filter parameters
     * @param paging Paging parameters
     * @param callback a callback function that returns page with entities or error
     */
    getByFilter(correlationId: string, filter: FilterParams, paging: PagingParams,
        callback: (err: any, page: DataPage<T>) => void): void;

    /**
     * Gets an entity given an entity id
     * @param correlationId A unique process or correlation id
     * @param entityId A unique entity id
     * @param callback a callback function that returns entity or error
     */
    getOneById(correlationId: string, entityId: K, callback: (err: any, entity: T) => void): void;

    /**
     * Creates an new entity and returns entity value with all populated fields.
     * This operation is not idenponent. Attempt to create an entity with id that already
     * exist shall cause an exception.
     * @param correlationId A unique process or correlation id
     * @param entity an entity to be created
     * @param callback a callback function that returns created entity or error
     */
    create(correlationId: string, entity: T, callback: (err: any, entity: T) => void): void;

    /**
     * Updates an entity. In most adapters attempt to update a non-exited entities may create one.
     * @param correlationId A unique process or correlation id
     * @param entity an entity to be updated
     * @param callback a callback function that returns updated entity or error
     */
    update(correlationId: string, entity: T, callback: (err: any, entity: T) => void): void;

    /**
     * Deletes an eitity, given an entity id. If entity does not exist, the operation doesn't do anything
     * @param correlationId A unique process or correlation id
     * @param entityId A unique entity id
     * @param callback a callback function that returns deleted entity or error
     */
    deleteById(correlationId: string, entityId: K, callback: (err: any, entity: T) => void): void;

    // /**
    //  * Gets client status...
    //  * @param correlationId A unique process or correlation id
    //  * @param entityId A unique entity id
    //  * @param callback a callback function that returns client status or error
    //  */
    // getStatus(correlationId: string, callback: (err: any, status: StringValueMap) => void): void;
}