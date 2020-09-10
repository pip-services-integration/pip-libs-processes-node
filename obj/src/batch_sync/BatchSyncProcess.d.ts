import { Process } from '../logic/Process';
import { Parameters, IReferences } from 'pip-services3-commons-node';
export declare class BatchSyncProcess<T> extends Process {
    constructor(processType: string, references?: IReferences, parameters?: Parameters);
}
