import { Descriptor } from 'pip-services3-commons-node';
export declare class KnownDescriptors {
    static TempBlobs: Descriptor;
    static Settings: Descriptor;
    static EventLog: Descriptor;
    static ProcessStates: Descriptor;
    static Mappings: Descriptor;
    static Retries: Descriptor;
    static messageQueue(name: string): Descriptor;
}
