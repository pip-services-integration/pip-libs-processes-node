"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
class EntityPostponeException extends pip_services3_commons_node_1.InvalidStateException {
    /**
     * Creates an error instance and assigns its values.
     *
     * @param correlationId    (optional) a unique transaction id to trace execution through call chain.
     * @param entityId         (optional) an entity id
     * @param message           (optional) a human-readable description of the error.
     */
    constructor(correlationId = null, entityId = null, message = null) {
        super(correlationId, 'ENTITY_POSTPONE', message || 'Processing of entity with id ' + entityId + ' shall be postponed');
        this.withDetails('entity_id', entityId);
    }
}
exports.EntityPostponeException = EntityPostponeException;
//# sourceMappingURL=EntityPostponeException.js.map