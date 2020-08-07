import { IReferences, IReferenceable, ApplicationException } from "pip-services3-commons-node";
import { CompositeLogger, CompositeCounters, Timing } from "pip-services3-components-node";
import { ICapableClient } from "./ICapableClient";
import { CapabilitiesMap } from "../data/CapabilitiesMap";


export class AdapterClient implements ICapableClient, IReferenceable {

    private _references: IReferences;
    private _logger: CompositeLogger = new CompositeLogger();
    private _counters: CompositeCounters = new CompositeCounters();

    public adapter: string; //{ get; private set; }
    public service: string; //{ get; private set; }
    public address: string; //{ get; private set;  }
    public capabilities: CapabilitiesMap;// { get; private set; }

    public constructor(adapter: string, service: string, address: string) {

        if (address == null || address == "")
            throw new ApplicationException("Service URL is required");

        this.adapter = adapter ?? this.constructor.name;
        this.service = service;
        this.address = address;
        this.capabilities = new CapabilitiesMap();
    }

    public setReferences(references: IReferences) {
        this._references = references;
        this._logger.setReferences(references);
        this._counters.setReferences(references);
    }

    protected instrument(correlationId: string, methodName: string, message: string = ""): Timing {
        this._logger.trace(correlationId, "Called {0}.{1}.{2} {3}", this.adapter, this.service, methodName, message);
        return this._counters.beginTiming(this.adapter + "." + this.service + "." + methodName + ".call_time");
    }

    protected handleError(correlationId: string, methodName: string, error: any): any {
        this._logger.error(correlationId, error, "Failed to call {0}.{1}.{2}", this.adapter, this.service, methodName);

        // Unwrap the exception
        while (error.InnerException != null)
            error = error.InnerException;

        return error;
    }

    public getCapabilities(): CapabilitiesMap {
        return this.capabilities;
    }

}