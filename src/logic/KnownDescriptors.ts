import { Descriptor } from 'pip-services3-commons-node';

export class KnownDescriptors {

    public static readonly MessageQueueType: string = 'message-queue';

    public static TempBlobs: Descriptor = new Descriptor('pip-services-tempblobs', 'client', '*', '*', '1.0');
    public static Settings: Descriptor = new Descriptor('pip-services-settings', 'client', '*', '*', '1.0');
    public static EventLog: Descriptor = new Descriptor('pip-services-eventlog', 'client', '*', '*', '1.0');
    public static ProcessStates: Descriptor = new Descriptor('pip-clients-processstates', 'client', '*', '*', '*');
    public static Mappings: Descriptor = new Descriptor('pip-clients-mappings', 'client', '*', '*', '*');
    public static Retries: Descriptor = new Descriptor('pip-clients-retries', 'client', '*', '*', '1.0');

    public static messageQueue(name: string): Descriptor {
        return new Descriptor('*', KnownDescriptors.MessageQueueType, '*', name, '*');
    }
}