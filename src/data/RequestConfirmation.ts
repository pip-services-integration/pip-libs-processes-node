export class RequestConfirmation {
    public request_id: string;
    public correlation_id: string;
    public blob_ids?: string[];
    public data?: string;
    public successful: boolean;
    public error?: string; 

    public getData(): any {
        try {
            if (this.data == null) return null;
            return JSON.parse(this.data);
        } catch (Exception) {
            return null;
        }
    }

    public getDataAs<T>(): T {
        return this.getData() as T;
    }

    public setData(data: any): void {
        if (data == null)
            this.data = null;
        else
           this.data = JSON.stringify(data);
    }
}