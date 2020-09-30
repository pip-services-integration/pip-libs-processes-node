import { AdapterMemoryClient } from "./AdapterMemoryClient";
import { TestEntity } from "./TestEntity";
import { ITestAdapterClient } from "./ITestAdapterClient";
import { Parameters, IReferences } from "pip-services3-commons-node";
export declare class TestAdapterMemoryClient extends AdapterMemoryClient<TestEntity, string> implements ITestAdapterClient {
    protected static readonly _defaultParameters: Parameters;
    constructor(entities: TestEntity[], references?: IReferences, parameters?: Parameters);
}
