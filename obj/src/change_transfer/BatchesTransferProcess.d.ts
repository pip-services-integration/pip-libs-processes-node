import { TransferProcess } from './TransferProcess';
import { IReferences } from 'pip-services3-commons-node';
import { Parameters } from 'pip-services3-commons-node';
export declare class BatchesTransferProcess<T, K> extends TransferProcess<T, K> {
    constructor(processType: string, references: IReferences, parameters: Parameters);
}
