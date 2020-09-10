export declare class RequestConfirmation {
    request_id: string;
    correlation_id: string;
    blob_ids?: string[];
    data?: string;
    successful: boolean;
    error?: string;
    getData(): any;
    getDataAs<T>(): T;
    setData(data: any): void;
}
