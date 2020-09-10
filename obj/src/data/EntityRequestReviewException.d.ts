import { InvalidStateException } from 'pip-services3-commons-node';
export declare class EntityRequestReviewException extends InvalidStateException {
    /**
     * Creates an error instance and assigns its values.
     *
     * @param correlationId    (optional) a unique transaction id to trace execution through call chain.
     * @param entityId         (optional) an entity id
     * @param message           (optional) a human-readable description of the error.
     */
    constructor(correlationId?: string, entityId?: string, message?: string);
}
