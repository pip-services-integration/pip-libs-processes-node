import { Task } from '../logic/Task';
export declare class BatchSyncCloseTask<T> extends Task {
    execute(callback: (err: any) => void): void;
}
