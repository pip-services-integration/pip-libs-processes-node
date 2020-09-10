import { Task } from '../logic/Task';
export declare class BatchMultiSyncCloseTask<T> extends Task {
    execute(callback: (err: any) => void): void;
}
