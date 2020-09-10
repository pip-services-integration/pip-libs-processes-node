import { SequenceTransferProcess } from './SequenceTransferProcess';
import { IReferences } from 'pip-services3-commons-node';
import { Parameters } from 'pip-services3-commons-node';
export declare class ChangesSequenceTransferProcess<T, K> extends SequenceTransferProcess<T, K> {
    constructor(processType: string, references: IReferences, parameters: Parameters);
}
