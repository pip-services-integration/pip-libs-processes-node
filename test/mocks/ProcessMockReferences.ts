import { MockReferences } from "./MockReferences";
import { KnownDescriptors } from "../../src";
import { EventLogNullClientV1 } from "pip-clients-eventlog-node";
import { ITempBlobsClientV1 } from "pip-clients-tempblobs-node";
import { TempBlobsDirectClientV1 } from "pip-clients-tempblobs-node";
import { BlobsMemoryPersistence } from "pip-services-blobs-node";
import { BlobsController } from "pip-services-blobs-node";
import { RetriesMemoryClientV1 } from "pip-clients-retries-node";
import { MappingsMemoryClientV1 } from 'pip-clients-mappings-node';
import { IProcessStatesClient, ProcessStatesDirectClientV1 } from 'pip-clients-processstates-node';
import { ProcessStatesMemoryPersistence, ProcessStatesController } from 'pip-services-processstates-node';
import { ConfigParams, References, Descriptor } from "pip-services3-commons-node";
import { SettingsMemoryPersistence } from 'pip-services-settings-node';
import { SettingsController } from 'pip-services-settings-node';
import { ISettingsClientV1 } from 'pip-clients-settings-node';
import { SettingsDirectClientV1 } from 'pip-clients-settings-node';
import { ConsoleLogger } from "pip-services3-components-node";
import { IMessageQueue, MemoryMessageQueue } from "pip-services3-messaging-node";

export class ProcessMockReferences extends MockReferences {
    public constructor(components: any[]) {
        super(null, components);

        this._references.put(KnownDescriptors.Settings, this.createSettingsClientMock());
        this._references.put(KnownDescriptors.TempBlobs, this.createTempBlobsClientMock());
        this._references.put(KnownDescriptors.ProcessStates, this.createProcessStatesClientMock());
        this._references.put(KnownDescriptors.EventLog, new EventLogNullClientV1());
        this._references.put(KnownDescriptors.Retries, new RetriesMemoryClientV1());
        this._references.put(KnownDescriptors.Mappings, new MappingsMemoryClientV1());
    }

    public getOneRequired<T>(locator: any): T {
        if (locator instanceof Descriptor && locator.getType() == KnownDescriptors.MessageQueueType) {
            var queue = super.getOneRequired<MemoryMessageQueue>(locator);
            if (typeof queue['configure'] === 'function') {
                queue.configure(ConfigParams.fromTuples('listen_interval', 1));
            }
            return queue as any as T;
        }

        return super.getOneRequired<T>(locator);
    }

    private createTempBlobsClientMock(): ITempBlobsClientV1 {
        let logger = new ConsoleLogger();
        let persistence = new BlobsMemoryPersistence();
        let controller = new BlobsController();

        let references: References = References.fromTuples(
            new Descriptor('pip-services-commons', 'logger', 'console', 'default', '1.0'), logger,
            new Descriptor('pip-services-blobs', 'persistence', 'memory', 'default', '1.0'), persistence,
            new Descriptor('pip-services-blobs', 'controller', 'default', 'default', '1.0'), controller,
        );
        controller.setReferences(references);

        let client = new TempBlobsDirectClientV1();
        client.configure(ConfigParams.fromTuples(
            'options.chunk_size', 1024,
        ));
        client.setReferences(references);

        persistence.configure(ConfigParams.fromTuples(
            'options.max_blob_size', 1000 * 1024
        ));
        persistence.open(null, null);

        return client;
    }

    private createProcessStatesClientMock(): IProcessStatesClient {
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

    private createSettingsClientMock(): ISettingsClientV1 {
        let persistence = new SettingsMemoryPersistence();
        let controller = new SettingsController();

        let client = new SettingsDirectClientV1();
        let references: References = References.fromTuples(
            new Descriptor('pip-services-settings', 'persistence', 'memory', 'default', '1.0'), persistence,
            new Descriptor('pip-services-settings', 'controller', 'default', 'default', '1.0'), controller,
            new Descriptor('pip-services-settings', 'client', 'direct', 'default', '1.0'), client
        );
        controller.setReferences(references);

        client.setReferences(references);

        persistence.open(null, null);

        return client;
    }
}