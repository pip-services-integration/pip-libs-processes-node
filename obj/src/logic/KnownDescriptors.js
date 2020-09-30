"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnownDescriptors = void 0;
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
class KnownDescriptors {
    static messageQueue(name) {
        return new pip_services3_commons_node_1.Descriptor('*', KnownDescriptors.MessageQueueType, '*', name, '*');
    }
}
exports.KnownDescriptors = KnownDescriptors;
KnownDescriptors.MessageQueueType = 'message-queue';
KnownDescriptors.TempBlobs = new pip_services3_commons_node_1.Descriptor('pip-services-tempblobs', 'client', '*', '*', '1.0');
KnownDescriptors.Settings = new pip_services3_commons_node_1.Descriptor('pip-services-settings', 'client', '*', '*', '1.0');
KnownDescriptors.EventLog = new pip_services3_commons_node_1.Descriptor('pip-services-eventlog', 'client', '*', '*', '1.0');
KnownDescriptors.ProcessStates = new pip_services3_commons_node_1.Descriptor('pip-clients-processstates', 'client', '*', '*', '*');
KnownDescriptors.Mappings = new pip_services3_commons_node_1.Descriptor('pip-clients-mappings', 'client', '*', '*', '*');
KnownDescriptors.Retries = new pip_services3_commons_node_1.Descriptor('pip-clients-retries', 'client', '*', '*', '1.0');
//# sourceMappingURL=KnownDescriptors.js.map