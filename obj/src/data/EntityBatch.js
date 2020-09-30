"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityBatch = void 0;
class EntityBatch {
    constructor(batchId = null, entities = null) {
        this.batch_id = batchId;
        this.entities = entities || [];
    }
}
exports.EntityBatch = EntityBatch;
//# sourceMappingURL=EntityBatch.js.map