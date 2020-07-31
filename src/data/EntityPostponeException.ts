import { InvalidStateException } from 'pip-services3-commons-node';

export class EntityPostponeException extends InvalidStateException {	
	/**
	 * Creates an error instance and assigns its values.
	 * 
     * @param correlationId    (optional) a unique transaction id to trace execution through call chain.
     * @param entityId         (optional) an entity id
     * @param message           (optional) a human-readable description of the error.
	 */
	public constructor(correlationId: string = null, entityId: string = null, message: string = null) {
        super(correlationId, 'ENTITY_POSTPONE', message || 'Processing of entity with id ' + entityId + ' shall be postponed');
        this.withDetails('entity_id', entityId);
	}
}