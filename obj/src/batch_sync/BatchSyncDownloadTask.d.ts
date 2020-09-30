import { Task } from '../logic/Task';
export declare class BatchSyncDownloadTask<T> extends Task {
    private readonly defaultInitialSyncInterval;
    execute(callback: (err: any) => void): void;
    private getStartSyncTimeUtc;
}
