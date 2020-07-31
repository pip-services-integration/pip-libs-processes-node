import { UnknownException } from 'pip-services3-commons-node';

export class RandomTestException extends UnknownException {	
	/**
	 * Creates an error instance and assigns its values.
     * @param correlationId    (optional) a unique transaction id to trace execution through call chain.
	 */
	public constructor(correlationId: string = null) {
        super(correlationId, 'TEST', 'Random test error');
	}
}