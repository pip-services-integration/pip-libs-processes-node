import { Task } from '../logic/Task';
export declare class BatchSyncRecoveryTask<T> extends Task {
    execute(callback: (err: any) => void): void;
    private recoveryDownload;
    private recoveryUpload;
}
