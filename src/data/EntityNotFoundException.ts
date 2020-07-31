import { NotFoundException } from 'pip-services3-commons-node';

export class EntityNotFoundException extends NotFoundException {	
	/**
	 * Creates an error instance and assigns its values.
	 * 
     * @param correlationId    (optional) a unique transaction id to trace execution through call chain.
     * @param entityId         (optional) an entity id
     * @param message           (optional) a human-readable description of the error.
	 */
	public constructor(correlationId: string = null, entityId: string = null, message: string = null) {
        super(correlationId, 'ENTITY_NOT_FOUND', message || 'Entity with id ' + entityId + ' was not found');
        this.withDetails('entity_id', entityId);
	}
}