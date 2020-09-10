import { Parameters, IReferences, FilterParams } from 'pip-services3-commons-node';
import { MessageGenerator } from './MessageGenerator';
import { IMessageQueue } from 'pip-services3-messaging-node';
import { ITempBlobsClientV1 } from 'pip-clients-tempblobs-node';
import { ISettingsClientV1 } from 'pip-clients-settings-node';
export declare class ChangesPollGenerator<T, K> extends MessageGenerator {
    protected static readonly _defaultParameters: Parameters;
    protected _settingsClient: ISettingsClientV1;
    protected _tempBlobClient: ITempBlobsClientV1;
    EntitiesPerRequest: number;
    StatusSection: string;
    InitialSyncInterval: number;
    SyncDelay: number;
    Filter: FilterParams;
    LastSyncTimeUtc: Date;
    constructor(component: string, queue: IMessageQueue, references: IReferences, parameters?: Parameters);
    setReferences(references: IReferences): void;
    setParameters(parameters: Parameters): void;
    protected getFilter(): FilterParams;
    protected getStartSyncTimeUtcAsync(callback: (err: any, result: Date) => void): void;
    execute(callback: (err: any) => void): void;
}
