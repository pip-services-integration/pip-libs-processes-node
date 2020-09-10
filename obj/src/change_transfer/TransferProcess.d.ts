import { Process } from "../logic";
import { Parameters, IReferences } from "pip-services3-commons-node";
import { MessageGenerator } from "../generators/MessageGenerator";
export declare class TransferProcess<T, K> extends Process {
    protected _generator: MessageGenerator;
    protected static readonly _defaultParameters: Parameters;
    constructor(processType: string, references: IReferences, parameters: Parameters);
    setParameters(parameters: Parameters): void;
    beginListen(): void;
    close(correlationId: string, callback: (err: any) => void): void;
}
