import { AdapterMemoryClient } from "./AdapterMemoryClient";
import { TestEntity } from "./TestEntity";
import { ITestAdapterClient } from "./ITestAdapterClient";
import { Parameters, IReferences } from "pip-services3-commons-node";
import { ClientParam } from "./ClientParam";
import { TestMessageType } from "./TestMessageType";
import { TestEntityGenerator } from "./TestEntityGenerator";

export class TestAdapterMemoryClient extends AdapterMemoryClient<TestEntity, string> implements ITestAdapterClient {
    protected static readonly _defaultParameters: Parameters = Parameters.fromTuples(
        ClientParam.PageSize, 100,
        ClientParam.InitialNumberOfEntities, 100,
        ClientParam.BlobTimeToLive, 24 * 60 * 60 * 1000, // 1day
        ClientParam.ChangeNotifyMessageType, TestMessageType.ChangeNotify,
        ClientParam.DownloadAllMessageType, TestMessageType.DownloadAllResponse,
        ClientParam.UploadAllMessageType, TestMessageType.UploadAllResponse,
        ClientParam.DownloadChangesMessageType, TestMessageType.DownloadAllResponse,
        ClientParam.UploadChangesMessageType, TestMessageType.UploadChangesResponse
    );

    constructor(entities: TestEntity[], references?: IReferences, parameters?: Parameters) {
        super("TestAdapter", "TestEntity", entities, new TestEntityGenerator(), references,
            TestAdapterMemoryClient._defaultParameters.override(parameters))
    }
}