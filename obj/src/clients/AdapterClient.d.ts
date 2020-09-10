import { IReferences, IReferenceable } from "pip-services3-commons-node";
import { Timing } from "pip-services3-components-node";
import { ICapableClient } from "./ICapableClient";
import { CapabilitiesMap } from "../data/CapabilitiesMap";
export declare class AdapterClient implements ICapableClient, IReferenceable {
    private _references;
    private _logger;
    private _counters;
    adapter: string;
    service: string;
    address: string;
    capabilities: CapabilitiesMap;
    constructor(adapter: string, service: string, address: string);
    setReferences(references: IReferences): void;
    protected instrument(correlationId: string, methodName: string, message?: string): Timing;
    protected handleError(correlationId: string, methodName: string, error: any): any;
    getCapabilities(): CapabilitiesMap;
}
