import { IReferenceable } from 'pip-services3-commons-node';
import { IParameterized } from 'pip-services3-commons-node';
import { IClosable } from 'pip-services3-commons-node';
import { IMessageReceiver } from 'pip-services3-messaging-node';

/**
 * The interface that defines the behaviour of Task Handler
 */
export interface ITaskHandler extends IMessageReceiver, IReferenceable, IParameterized, IClosable {
    beginListen(): void;
}