import { FilterParams } from "pip-services3-commons-node";

export interface IBatchEventsClient<T>
{
    /**
     * Downloads integration events from an external system into blobs
     * and sends confirmation with blob ids to provided response queue
     * @param correlationId Unique process or correlation id
     * @param filter Additional array of filters
     * @param fromTime Starting date to retrieve the changes. 
     * @param toTime Ending date to retrieve the changes. Adapters may impose additional restrictions on how long into the history it may go
     * @param responseQueueName Logical queue name where to send async response
     * @param requestId Optional id of the request
     */    
    downloadEvents(correlationId: string, filter: FilterParams, fromTime: Date,
        toTime: Date, responseQueueName: string, requestId?: string, 
        callback?: (err: any) => void): void;

    /**
     * Uploads integration events from blobs and saves it into the target system
     * @param correlationId Unique process or correlation id
     * @param blobIds Array of blob ids there data is stored
     * @param responseQueueName Logical queue name where to send async response
     * @param requestId Optional id of the request
     */
    uploadEvents(correlationId: string, blobIds: string[], responseQueueName: string, requestId?: string, 
        callback?: (err: any) => void): void;
}