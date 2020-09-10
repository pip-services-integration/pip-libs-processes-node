import { Process } from '../logic/Process';
import { IReferences } from 'pip-services3-commons-node';
import { Parameters } from 'pip-services3-commons-node';
export declare class BatchMultiSyncProcess<T> extends Process {
    constructor(processType: string, references?: IReferences, parameters?: Parameters);
}
