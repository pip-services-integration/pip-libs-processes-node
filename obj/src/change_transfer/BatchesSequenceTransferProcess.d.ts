import { IReferences } from 'pip-services3-commons-node';
import { Parameters } from 'pip-services3-commons-node';
import { SequenceTransferProcess } from './SequenceTransferProcess';
export declare class BatchesSequenceTransferProcess<T, K> extends SequenceTransferProcess<T, K> {
    constructor(processType: string, references: IReferences, parameters: Parameters);
}
