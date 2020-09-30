import { ITaskHandler } from "../../src";
import { MessageEnvelope } from "pip-services3-messaging-node";

export interface IMockTaskHandler extends ITaskHandler {
    receivedMessages: MessageEnvelope[];
}