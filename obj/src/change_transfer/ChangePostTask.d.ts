import { Task } from '../logic/Task';
import { IMessageQueue, MessageEnvelope } from 'pip-services3-messaging-node';
export declare class ChangePostTask<T, K> extends Task {
    protected static readonly DefaultPostponeTimeout: number;
    protected makeRetryKey(entity: any): string;
    protected checkRetry(entity: any, callback: (err: any, result: boolean) => void): void;
    protected writeRetry(entity: any, callback: (err: any) => void): void;
    protected retrieveEntity(message: MessageEnvelope, queue: IMessageQueue, callback: (err: any, entity: T) => void): void;
    protected getId(prefix: string, entity: any): string;
    protected startTask(entity: T, callback: (err: any) => void): void;
    protected postEntity(entity: any, queue: IMessageQueue, callback: (err: any) => void): void;
    protected isFinal(): any;
    protected endTask(callback: (err: any) => void): void;
    protected deleteEntityBlob(message: MessageEnvelope, callback: (err: any) => void): void;
    execute(callback: (err: any) => void): void;
    private postEntityErrorHandler;
    private isChangeable;
    private isIdentifiable;
}
