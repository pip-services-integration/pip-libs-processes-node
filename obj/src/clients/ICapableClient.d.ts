import { CapabilitiesMap } from '../data/CapabilitiesMap';
export interface ICapableClient {
    getCapabilities(): CapabilitiesMap;
}
