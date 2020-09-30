"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestPostponeAdapterMemoryClient = void 0;
const TestAdapterMemoryClient_1 = require("./TestAdapterMemoryClient");
const EntityPostponeException_1 = require("../data/EntityPostponeException");
class TestPostponeAdapterMemoryClient extends TestAdapterMemoryClient_1.TestAdapterMemoryClient {
    constructor(entities, references, parameters = null) {
        super(entities, references, parameters);
    }
    create(correlationId, entity, callback) {
        if (this.postpone) {
            callback(new EntityPostponeException_1.EntityPostponeException(entity.id, "Entity was postponed"), entity);
            return;
        }
        super.create(correlationId, entity, callback);
    }
}
exports.TestPostponeAdapterMemoryClient = TestPostponeAdapterMemoryClient;
//# sourceMappingURL=TestPostponeAdapterMemoryClient.js.map