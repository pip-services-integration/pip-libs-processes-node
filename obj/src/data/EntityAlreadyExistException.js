"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityAlreadyExistException = void 0;
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
class EntityAlreadyExistException extends pip_services3_commons_node_1.BadRequestException {
    /**
     * Creates an error instance and assigns its values.
     *
     * @param correlationId    (optional) a unique transaction id to trace execution through call chain.
     * @param entityId         (optional) an entity id
     * @param message           (optional) a human-readable description of the error.
     */
    constructor(correlationId = null, entityId = null, message = null) {
        super(correlationId, 'ENTITY_ALREADY_EXIST', message || 'Entity with id ' + entityId + ' already exist');
        this.withDetails('entity_id', entityId);
        Object.setPrototypeOf(this, EntityAlreadyExistException.prototype);
    }
}
exports.EntityAlreadyExistException = EntityAlreadyExistException;
//# sourceMappingURL=EntityAlreadyExistException.js.map