import { MessageEnvelope } from "pip-services3-messaging-node";

export class LockedMessage {
    /**
     * The incoming message.
     */
    public message: MessageEnvelope;

    /**
     * The expiration time for the message lock.
     * If it is null then the message is not locked.
     */
    public expirationTime: Date;

    /**
     * The lock timeout in milliseconds.
     */
    public timeout: number;
}