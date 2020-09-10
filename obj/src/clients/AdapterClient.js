"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const pip_services3_components_node_1 = require("pip-services3-components-node");
const CapabilitiesMap_1 = require("../data/CapabilitiesMap");
class AdapterClient {
    constructor(adapter, service, address) {
        this._logger = new pip_services3_components_node_1.CompositeLogger();
        this._counters = new pip_services3_components_node_1.CompositeCounters();
        if (address == null || address == "")
            throw new pip_services3_commons_node_1.ApplicationException("Service URL is required");
        this.adapter = (adapter !== null && adapter !== void 0 ? adapter : this.constructor.name);
        this.service = service;
        this.address = address;
        this.capabilities = new CapabilitiesMap_1.CapabilitiesMap();
    }
    setReferences(references) {
        this._references = references;
        this._logger.setReferences(references);
        this._counters.setReferences(references);
    }
    instrument(correlationId, methodName, message = "") {
        this._logger.trace(correlationId, "Called {0}.{1}.{2} {3}", this.adapter, this.service, methodName, message);
        return this._counters.beginTiming(this.adapter + "." + this.service + "." + methodName + ".call_time");
    }
    handleError(correlationId, methodName, error) {
        this._logger.error(correlationId, error, "Failed to call {0}.{1}.{2}", this.adapter, this.service, methodName);
        // Unwrap the exception
        while (error.InnerException != null)
            error = error.InnerException;
        return error;
    }
    getCapabilities() {
        return this.capabilities;
    }
}
exports.AdapterClient = AdapterClient;
//# sourceMappingURL=AdapterClient.js.map