export interface IBatchAllClient<T> {
    /**
     * Downloads all entities from external system into blobs
     * and sends confirmation with blob ids to provided response queue
     * @param correlationId a unique process or correlation id
     * @param responseQueueName a queue name where to send async response
     * @param requestId an optional id of the request
     * @param callback a callback function that returns null or error
     */
    downloadAll(correlationId: string, responseQueueName: string, requestId: string, callback: (err: any) => void): void;
    /**
     * Uploads all entities from blobs and saves it into the target system
     * @param correlationId a unique process or correlation id
     * @param blobIds an array of blob ids there data is stored
     * @param responseQueueName a queue name where to send async response
     * @param requestId an optional id of the request
     * @param callback a callback function that returns null or error
     */
    uploadAll(correlationId: string, blobIds: string[], responseQueueName: string, requestId: string, callback: (err: any) => void): void;
}
