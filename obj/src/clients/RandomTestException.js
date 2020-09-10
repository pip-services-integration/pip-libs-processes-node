"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
class RandomTestException extends pip_services3_commons_node_1.UnknownException {
    /**
     * Creates an error instance and assigns its values.
     * @param correlationId    (optional) a unique transaction id to trace execution through call chain.
     */
    constructor(correlationId = null) {
        super(correlationId, 'TEST', 'Random test error');
    }
}
exports.RandomTestException = RandomTestException;
//# sourceMappingURL=RandomTestException.js.map