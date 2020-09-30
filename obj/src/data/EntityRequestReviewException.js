"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityRequestReviewException = void 0;
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
class EntityRequestReviewException extends pip_services3_commons_node_1.InvalidStateException {
    /**
     * Creates an error instance and assigns its values.
     *
     * @param correlationId    (optional) a unique transaction id to trace execution through call chain.
     * @param entityId         (optional) an entity id
     * @param message           (optional) a human-readable description of the error.
     */
    constructor(correlationId = null, entityId = null, message = null) {
        super(correlationId, 'ENTITY_REQUEST_REVIEW', message || 'Requested review for entity with id ' + entityId);
        this.withDetails('entity_id', entityId);
        Object.setPrototypeOf(this, EntityRequestReviewException.prototype);
    }
}
exports.EntityRequestReviewException = EntityRequestReviewException;
//# sourceMappingURL=EntityRequestReviewException.js.map