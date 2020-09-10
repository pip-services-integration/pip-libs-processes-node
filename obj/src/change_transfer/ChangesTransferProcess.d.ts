import { IReferences } from 'pip-services3-commons-node';
import { Parameters } from 'pip-services3-commons-node';
import { TransferProcess } from './TransferProcess';
export declare class ChangesTransferProcess<T, K> extends TransferProcess<T, K> {
    constructor(processType: string, references: IReferences, parameters: Parameters);
}
