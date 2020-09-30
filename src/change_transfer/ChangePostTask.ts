let async = require('async');

import { Task } from '../logic/Task';
import { StringConverter, IIdentifiable } from 'pip-services3-commons-node';
import { ChangesTransferParam } from './ChangesTransferParam';
import { IMessageQueue, MessageEnvelope } from 'pip-services3-messaging-node';
import { DataEnvelopV1 } from 'pip-clients-tempblobs-node';
import { ProcessParam } from '../logic/ProcessParam';
import { IReadWriteClient } from '../clients/IReadWriteClient';
import { IChangeable } from '../data/IChangeable';
import { EntityAlreadyExistException } from '../data/EntityAlreadyExistException';
import { EntityNotFoundException } from '../data/EntityNotFoundException';
import { ProcessNotFoundExceptionV1, ProcessStoppedExceptionV1 } from 'pip-clients-processstates-node';
import { EntityRequestReviewException } from '../data/EntityRequestReviewException';
import { EntityPostponeException } from '../data/EntityPostponeException';

export class ChangePostTask<T, K> extends Task {
    protected static readonly DefaultPostponeTimeout: number = 12 * 60 * 1000; // 12h

    protected makeRetryKey(entity: any): string {
        // We do not support non-identifiable entities
        if (!this.isChangeable(entity) || !this.isIdentifiable(entity)) return null;

        return entity.id.toString() + '-' + StringConverter.toString(entity.change_time);
    }

    protected checkRetry(entity: any, callback: (err: any, result: boolean) => void) {
        var retriesGroup = this._parameters.getAsNullableString(ChangesTransferParam.RetriesGroup);
        if (retriesGroup == null) {
            callback(null, false);
            return;
        }

        var entityKey = this.makeRetryKey(entity);
        if (entityKey == null) {
            callback(null, false);
            return;
        }

        this._retriesClient.getRetryById(this.correlationId, retriesGroup, entityKey, (err, retry) => {
            callback(err, retry != null);
        });
    }

    protected writeRetry(entity: any, callback: (err: any) => void) {
        var retriesGroup = this._parameters.getAsNullableString(ChangesTransferParam.RetriesGroup);
        if (retriesGroup == null) {
            callback(null);
            return;
        }

        var entityKey = this.makeRetryKey(entity);
        if (entityKey == null) {
            callback(null);
            return;
        }

        this._retriesClient.addRetry(this.correlationId, retriesGroup, entityKey, null, (err, retry) => {
            callback(err);
        });
    }

    protected retrieveEntity(message: MessageEnvelope, queue: IMessageQueue,
        callback: (err: any, entity: T) => void) {
        let entity: T = null;

        async.series([
            (callback) => {
                // Try to deserialize the message
                async.series([
                    (callback) => {
                        var envelop = message.getMessageAsJson() as DataEnvelopV1<T>;

                        // Data can be sent as envelop
                        if (envelop != null && (envelop.blob_id != null || envelop.data != null)) {
                            this._tempBlobClient.readBlobConditional<T>(null, envelop, (err, data) => {
                                entity = data;
                                callback(err);
                            });
                        }
                        // Or data can be sent directly
                        else {
                            entity = message.getMessageAsJson() as T;
                            callback();
                        }
                    }
                ], (err) => {
                    if (err) {
                        this._logger.error(this.processId, err, 'Change cannot be deserialized from the message. Dropping message');
                        queue.moveToDeadLetter(message, callback);
                        return;
                    }

                    callback();
                });
            },
            (callback) => {
                // Check for valid entity
                if (entity == null) {
                    this._logger.debug(this.processId, 'Message contains no entity. Dropping message');
                    queue.complete(message, callback);
                    return;
                }

                callback();
            }
        ], (err) => {
            if (callback) callback(err, entity);
        });
    }

    protected getId(prefix: string, entity: any): string {
        if (this.isIdentifiable(entity)) {
            var id = entity.id.toString();
            return prefix + id;
        }

        return null;
    }

    protected startTask(entity: T, callback: (err: any) => void) {
        var initial = this._parameters.getAsBooleanWithDefault(ProcessParam.IsInitial, true);
        var prefix = this._parameters.getAsStringWithDefault(ChangesTransferParam.ProcessKeyPrefix, '');

        let processKey = this.getId(prefix, entity);
        if (processKey != null && processKey !== '') {
            this.activateOrStartProcessWithKey(processKey, (err, state) => {
                callback(err);
            });
        }
        // For other entities start a new process
        else {
            if (initial)
                this.startProcess(null, (err, state) => {
                    callback(err);
                });
            else
                this.activateProcess(null, (err, state) => {
                    callback(err);
                });
        }
    }

    protected postEntity(entity: any, queue: IMessageQueue, callback: (err: any) => void) {
        var postAdapter = this._parameters.getAsObject(ChangesTransferParam.PostAdapter) as IReadWriteClient<T, K>;
        var sendToUpdateAsyncOnly = this._parameters.getAsBoolean(ChangesTransferParam.SendToUpdateAsyncOnly);

        // For trackable entities call specific method
        if (this.isChangeable(entity)) {
            if (entity.deleted && !sendToUpdateAsyncOnly) {
                // Deletion is only supported for identifiable entities
                if (this.isIdentifiable<K>(entity)) {
                    postAdapter.deleteById(this.processId, entity.id, (err, entity) => {
                        this._logger.info(this.processId, 'Deleted %s by %s', entity, this.name);
                        callback(err);
                    });
                }
                else {
                    this._logger.warn(this.processId, 'Deleted %s is not trackable to be deleted. Processing skipped');
                }
            }
            else if (entity.create_time == entity.change_time && !sendToUpdateAsyncOnly) {
                async.series([
                    (callback) => {
                        // Try to create first
                        postAdapter.create(this.processId, entity as any as T, (err, entity) => {
                            this._logger.info(this.processId, 'Created %s by %s', entity, this.name);
                            callback(err);
                        });
                    }
                ], (err) => {
                    // Update on error
                    if (err instanceof EntityAlreadyExistException) {
                        this._logger.warn(this.processId, 'Found existing entity %s. Trying to update.', entity, this.processType, this.taskType);
                        postAdapter.update(this.processId, entity as any as T, (err, entity) => {
                            this._logger.info(this.processId, 'Updated %s by %s', entity, this.name);
                            callback(err);
                        });
                        return;
                    }

                    callback(err);
                });
            }
            else {
                async.series([
                    (callback) => {
                        // Try to update
                        postAdapter.update(this.processId, entity as any as T, (err, entity) => {
                            this._logger.info(this.processId, 'Updated %s by %s', entity, this.name);
                            callback(err);
                        });
                    }
                ], (err) => {
                    // Skip if entity wasn't found
                    if (err instanceof EntityNotFoundException) {
                        this._logger.warn(this.processId, 'Not found updated %s. Processing skipped.', entity);
                    }
                    callback(err);
                })
            }
        }
        // For non-trackable entities always call update
        else {
            postAdapter.update(this.processId, entity, (err, entity) => {
                callback(err);
            });
        }
    }

    protected isFinal() {
        var finalCheck = this._parameters.getAsObject(ProcessParam.FinalCheck);
        var final = this._parameters.getAsBooleanWithDefault(ProcessParam.IsFinal, true);

        if (finalCheck != null) {
            return finalCheck(this.processState);
        }

        return final;
    }

    protected endTask(callback: (err: any) => void) {
        let isFinal = this.isFinal();
        if (isFinal) {
            this.completeProcess(callback);
        }
        else {
            this.continueProcess(callback);
        }
    }

    protected deleteEntityBlob(message: MessageEnvelope, callback: (err: any) => void) {
        var envelop = this.message.getMessageAsJson() as DataEnvelopV1<T>;
        if (envelop != null && envelop.blob_id != null) {
            this._tempBlobClient.deleteBlobById(this.processId, envelop.blob_id, callback);
            return;
        }

        callback(null);
    }

    public execute(callback: (err: any) => void): void {
        var initial = this._parameters.getAsBooleanWithDefault(ProcessParam.IsInitial, true);

        this.retrieveEntity(this.message, this.queue, (err, entity) => {
            if (entity == null || err != null) {
                callback(err);
                return;
            }

            this.checkRetry(entity, (err, isRetries) => {
                // If retries are configured and this is a retry then exit
                // SS: Added initial check
                if (initial && isRetries) {
                    async.series([
                        (callback) => {
                            // Write retry to control number of attempts
                            this.writeRetry(entity, callback);
                        },
                        (callback) => {
                            this._logger.debug(this.correlationId, '%s already been processed. Skipping...', entity);

                            // Remove the message from the queue
                            this.queue.complete(this.message, callback);
                        },
                    ], (err) => {
                        callback(err);
                    });
                }
                else {
                    async.series([
                        (callback) => {
                            this.startTask(entity, callback);
                        },
                        (callback) => {
                            async.series([
                                (callback) => {
                                    this.postEntity(entity, this.queue, callback);
                                },
                            ], (err) => {
                                this.postEntityErrorHandler(err, (err1, terminate) => {
                                    if (terminate) {
                                        callback(err1);
                                        return;
                                    }

                                    async.series([
                                        (callback) => {
                                            this.endTask(callback);
                                        },
                                        (callback) => {
                                            let isFinal = this.isFinal();
                                            if (isFinal) {
                                                // Delete linked blob only at final task
                                                this.deleteEntityBlob(this.message, callback);
                                            }
                                            else {
                                                // Pass message to another queue
                                                // SS: Added forwarding message for seq transfer process
                                                var transferQueue = this._parameters.getAsObject(ChangesTransferParam.TransferQueue) as IMessageQueue;
                                                if (transferQueue != null) {
                                                    transferQueue.send(this.correlationId, this.message, callback);
                                                }
                                                else {
                                                    callback();
                                                }
                                            }
                                        },
                                        (callback) => {
                                            // SS: Added initial check
                                            if (initial) {
                                                // Remember retry only at initial task
                                                this.writeRetry(entity, callback);
                                            }
                                            else {
                                                callback();
                                            }
                                        }
                                    ], callback);
                                });
                            });
                        },
                    ], (err) => {
                        //if (err instanceof ProcessNotFoundExceptionV1) {
                        if (this.checkErrorType(err, ProcessNotFoundExceptionV1)) {
                            this._logger.error(this.processId, err, 'Received a message for unknown process %s. Skipping...', this.name);
                            this.moveMessageToDead(callback);
                            return;
                        }

                        //if (err instanceof ProcessStoppedExceptionV1) {
                        if (this.checkErrorType(err, ProcessStoppedExceptionV1)) {
                            this._logger.error(this.processId, err, 'Received a message for inactive process %s. Skipping...', this.name);
                            this.moveMessageToDead(callback);
                            return;
                        }

                        callback(err);
                    });
                }
            })
        });
    }

    private postEntityErrorHandler(error: any, callback: (err: any, terminate: boolean) => void): void {
        if (error instanceof EntityRequestReviewException) {

            this._logger.info(this.processId, 'User review was requested for %s', this.name);
            this.requestResponseForProcess(error.message, this.queue.getName(), this.message, (err) => {
                callback(err, true);
            });
            return;
        }

        if (error instanceof EntityPostponeException) {
            // On postpone fail the task and request recovery
            var postponeTimeout = this._parameters.getAsIntegerWithDefault(
                ChangesTransferParam.PostponeTimeout, ChangePostTask.DefaultPostponeTimeout);

            this._logger.info(this.processId, 'Processing of %s was postponed for %s', this.name, postponeTimeout);

            this.failAndRecoverProcess('Processing was postponed - ' + error.message,
                this.queue.getName(), this.message, postponeTimeout, (err) => {
                    callback(err, true);
                });

            return;
        }

        let taskCanceledException = null; // err as TaskCanceledException; - not supported by nodejs
        if (taskCanceledException != null) {
            // On postpone fail the task and request recovery
            var postponeTimeout = this._parameters.getAsIntegerWithDefault(
                ChangesTransferParam.PostponeTimeout, ChangePostTask.DefaultPostponeTimeout);

            this._logger.info(this.processId, 'Processing of %s was postponed for %s due to %s', this.name, postponeTimeout, taskCanceledException.message);

            this.failAndRecoverProcess('Processing was postponed - ' + taskCanceledException.message,
                this.queue.getName(), this.message, postponeTimeout, (err) => {
                    callback(err || taskCanceledException, true);
                });

            return;
        }

        callback(error, error != null);
    }

    private isChangeable(obj: any): obj is IChangeable {
        let changeable = obj as IChangeable;
        return changeable.deleted !== undefined || changeable.change_time !== undefined || changeable.create_time !== undefined;
    }

    private isIdentifiable<K>(obj: any): obj is IIdentifiable<K> {
        let identifiable = obj as IIdentifiable<K>;
        return identifiable.id !== undefined;
    }
}