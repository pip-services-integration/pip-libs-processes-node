import { MockReferences } from "./MockReferences";
import { KnownDescriptors } from "../../src";
import { SettingsNullClientV1 } from "pip-clients-settings-node";
import { EventLogNullClientV1 } from "pip-clients-eventlog-node";
import { TempBlobsNullClientV1 } from "pip-clients-tempblobs-node";
import { RetriesMemoryClientV1 } from "pip-clients-retries-node";
import { MappingsMemoryClientV1 } from 'pip-clients-mappings-node';
import { IProcessStatesClient, ProcessStatesDirectClientV1 } from 'pip-clients-processstates-node';
import { ProcessStatesMemoryPersistence, ProcessStatesController } from 'pip-services-processstates-node';
import { ConfigParams, References, Descriptor } from "pip-services3-commons-node";

export class ProcessMockReferences extends MockReferences {
    public constructor(components: any[]) {
        super(null, components);

        this._references.put(KnownDescriptors.Settings, new SettingsNullClientV1());
        this._references.put(KnownDescriptors.EventLog, new EventLogNullClientV1());
        this._references.put(KnownDescriptors.TempBlobs, new TempBlobsNullClientV1());
        this._references.put(KnownDescriptors.Retries, new RetriesMemoryClientV1());
        this._references.put(KnownDescriptors.Mappings, new MappingsMemoryClientV1());
        this._references.put(KnownDescriptors.ProcessStates, this.createProcessStatesClientMock());
    }

    private createProcessStatesClientMock() : IProcessStatesClient
    {
        let persistence = new ProcessStatesMemoryPersistence();
        persistence.configure(new ConfigParams());

        let controller = new ProcessStatesController();
        controller.configure(new ConfigParams());
        
        let client = new ProcessStatesDirectClientV1();
        let references = References.fromTuples(
            new Descriptor('pip-services-processstates', 'persistence', 'memory', 'default', '1.0'), persistence,
            new Descriptor('pip-services-processstates', 'controller', 'default', 'default', '1.0'), controller,
            new Descriptor('pip-services-processstates', 'client', 'direct', 'default', '1.0'), client
        );

        controller.setReferences(references);
        client.setReferences(references);

        persistence.open(null, null);

        return client;
    }
}