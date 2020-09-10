import { Process } from '../logic';
import { IReferences } from 'pip-services3-commons-node';
import { Parameters } from 'pip-services3-commons-node';
export declare class ChangePostProcess<T, K> extends Process {
    constructor(processType: string, references: IReferences, parameters: Parameters);
}
