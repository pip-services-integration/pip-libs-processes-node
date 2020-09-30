"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestAdapterMemoryClient = void 0;
const AdapterMemoryClient_1 = require("./AdapterMemoryClient");
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const ClientParam_1 = require("./ClientParam");
const TestMessageType_1 = require("./TestMessageType");
const TestEntityGenerator_1 = require("./TestEntityGenerator");
class TestAdapterMemoryClient extends AdapterMemoryClient_1.AdapterMemoryClient {
    constructor(entities, references, parameters) {
        super("TestAdapter", "TestEntity", entities, new TestEntityGenerator_1.TestEntityGenerator(), references, TestAdapterMemoryClient._defaultParameters.override(parameters));
    }
}
exports.TestAdapterMemoryClient = TestAdapterMemoryClient;
TestAdapterMemoryClient._defaultParameters = pip_services3_commons_node_1.Parameters.fromTuples(ClientParam_1.ClientParam.PageSize, 100, ClientParam_1.ClientParam.InitialNumberOfEntities, 100, ClientParam_1.ClientParam.BlobTimeToLive, 24 * 60 * 60 * 1000, // 1day
ClientParam_1.ClientParam.ChangeNotifyMessageType, TestMessageType_1.TestMessageType.ChangeNotify, ClientParam_1.ClientParam.DownloadAllMessageType, TestMessageType_1.TestMessageType.DownloadAllResponse, ClientParam_1.ClientParam.UploadAllMessageType, TestMessageType_1.TestMessageType.UploadAllResponse, ClientParam_1.ClientParam.DownloadChangesMessageType, TestMessageType_1.TestMessageType.DownloadAllResponse, ClientParam_1.ClientParam.UploadChangesMessageType, TestMessageType_1.TestMessageType.UploadChangesResponse);
//# sourceMappingURL=TestAdapterMemoryClient.js.map