import { Task } from '../logic/Task';
export declare class BatchSyncUploadTask<T> extends Task {
    execute(callback: (err: any) => void): void;
}
