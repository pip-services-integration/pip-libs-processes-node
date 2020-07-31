import { FilterParams } from "pip-services3-commons-node";

export interface IBatchChangesClient<T> {
    /**
     * Downloads changed entities from an external system into blobs
     * and sends confirmation with blob ids to provided response queue
     * @param correlationId a unique process or correlation id
     * @param filter optional filter to retrieve specific changes
     * @param fromTime Starting date and time to retrieve changes
     * @param toTime Ending date and time to retrieve changes
     * @param responseQueueName a queue name where to send async response
     * @param requestId an optional id of the request
     * @param callback a callback function that returns null or error
     */
    downloadChanges(correlationId: string, filter: FilterParams, fromTime: Date, toTime: Date,
        responseQueueName: string, requestId: string, callback: (err: any) => void): void;

    /**
     * Uploads all entities from blobs and saves it into the target system
     * @param correlationId a unique process or correlation id
     * @param blobIds an array of blob ids there data is stored
     * @param responseQueueName a queue name where to send async response
     * @param requestId an optional id of the request
     * @param callback a callback function that returns null or error
     */
    uploadChanges(correlationId: string, blobIds: string[], responseQueueName: string, requestId: string,
        callback: (err: any) => void): void;
}