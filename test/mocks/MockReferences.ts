import { ConfigParams } from "pip-services3-commons-node";
import { ManagedReferences } from "pip-services3-container-node";
import { MemoryConfigReader, LogCounters } from "pip-services3-components-node";
import { MessageQueueFactory } from "pip-services3-messaging-node";

export class MockReferences extends ManagedReferences {
    public constructor(config: ConfigParams, components: any[] = null) {
        super();

        config = config ?? new ConfigParams();
        this._references.put(null, new MemoryConfigReader(config));
        // this._references.put(null, new DiagnosticsLogger(config));
        this._references.put(null, new LogCounters());
        // this._references.put(null, new FixedRateReconfigNotifier());
        this._references.put(null, new MessageQueueFactory());

        // Add other components
        if (components != null) {
            components.forEach(component => this._references.put(null, component));
        }
    }
}