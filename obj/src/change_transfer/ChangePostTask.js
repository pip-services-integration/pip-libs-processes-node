"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangePostTask = void 0;
let async = require('async');
const Task_1 = require("../logic/Task");
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const ChangesTransferParam_1 = require("./ChangesTransferParam");
const ProcessParam_1 = require("../logic/ProcessParam");
const EntityAlreadyExistException_1 = require("../data/EntityAlreadyExistException");
const EntityNotFoundException_1 = require("../data/EntityNotFoundException");
const pip_clients_processstates_node_1 = require("pip-clients-processstates-node");
const EntityRequestReviewException_1 = require("../data/EntityRequestReviewException");
const EntityPostponeException_1 = require("../data/EntityPostponeException");
class ChangePostTask extends Task_1.Task {
    makeRetryKey(entity) {
        // We do not support non-identifiable entities
        if (!this.isChangeable(entity) || !this.isIdentifiable(entity))
            return null;
        return entity.id.toString() + '-' + pip_services3_commons_node_1.StringConverter.toString(entity.change_time);
    }
    checkRetry(entity, callback) {
        var retriesGroup = this._parameters.getAsNullableString(ChangesTransferParam_1.ChangesTransferParam.RetriesGroup);
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
    writeRetry(entity, callback) {
        var retriesGroup = this._parameters.getAsNullableString(ChangesTransferParam_1.ChangesTransferParam.RetriesGroup);
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
    retrieveEntity(message, queue, callback) {
        let entity = null;
        async.series([
            (callback) => {
                // Try to deserialize the message
                async.series([
                    (callback) => {
                        var envelop = message.getMessageAsJson();
                        // Data can be sent as envelop
                        if (envelop != null && (envelop.blob_id != null || envelop.data != null)) {
                            this._tempBlobClient.readBlobConditional(null, envelop, (err, data) => {
                                entity = data;
                                callback(err);
                            });
                        }
                        // Or data can be sent directly
                        else {
                            entity = message.getMessageAsJson();
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
            if (callback)
                callback(err, entity);
        });
    }
    getId(prefix, entity) {
        if (this.isIdentifiable(entity)) {
            var id = entity.id.toString();
            return prefix + id;
        }
        return null;
    }
    startTask(entity, callback) {
        var initial = this._parameters.getAsBooleanWithDefault(ProcessParam_1.ProcessParam.IsInitial, true);
        var prefix = this._parameters.getAsStringWithDefault(ChangesTransferParam_1.ChangesTransferParam.ProcessKeyPrefix, '');
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
    postEntity(entity, queue, callback) {
        var postAdapter = this._parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.PostAdapter);
        var sendToUpdateAsyncOnly = this._parameters.getAsBoolean(ChangesTransferParam_1.ChangesTransferParam.SendToUpdateAsyncOnly);
        // For trackable entities call specific method
        if (this.isChangeable(entity)) {
            if (entity.deleted && !sendToUpdateAsyncOnly) {
                // Deletion is only supported for identifiable entities
                if (this.isIdentifiable(entity)) {
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
                        postAdapter.create(this.processId, entity, (err, entity) => {
                            this._logger.info(this.processId, 'Created %s by %s', entity, this.name);
                            callback(err);
                        });
                    }
                ], (err) => {
                    // Update on error
                    if (err instanceof EntityAlreadyExistException_1.EntityAlreadyExistException) {
                        this._logger.warn(this.processId, 'Found existing entity %s. Trying to update.', entity, this.processType, this.taskType);
                        postAdapter.update(this.processId, entity, (err, entity) => {
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
                        postAdapter.update(this.processId, entity, (err, entity) => {
                            this._logger.info(this.processId, 'Updated %s by %s', entity, this.name);
                            callback(err);
                        });
                    }
                ], (err) => {
                    // Skip if entity wasn't found
                    if (err instanceof EntityNotFoundException_1.EntityNotFoundException) {
                        this._logger.warn(this.processId, 'Not found updated %s. Processing skipped.', entity);
                    }
                    callback(err);
                });
            }
        }
        // For non-trackable entities always call update
        else {
            postAdapter.update(this.processId, entity, (err, entity) => {
                callback(err);
            });
        }
    }
    isFinal() {
        var finalCheck = this._parameters.getAsObject(ProcessParam_1.ProcessParam.FinalCheck);
        var final = this._parameters.getAsBooleanWithDefault(ProcessParam_1.ProcessParam.IsFinal, true);
        if (finalCheck != null) {
            return finalCheck(this.processState);
        }
        return final;
    }
    endTask(callback) {
        let isFinal = this.isFinal();
        if (isFinal) {
            this.completeProcess(callback);
        }
        else {
            this.continueProcess(callback);
        }
    }
    deleteEntityBlob(message, callback) {
        var envelop = this.message.getMessageAsJson();
        if (envelop != null && envelop.blob_id != null) {
            this._tempBlobClient.deleteBlobById(this.processId, envelop.blob_id, callback);
            return;
        }
        callback(null);
    }
    execute(callback) {
        var initial = this._parameters.getAsBooleanWithDefault(ProcessParam_1.ProcessParam.IsInitial, true);
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
                                                var transferQueue = this._parameters.getAsObject(ChangesTransferParam_1.ChangesTransferParam.TransferQueue);
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
                        if (this.checkErrorType(err, pip_clients_processstates_node_1.ProcessNotFoundExceptionV1)) {
                            this._logger.error(this.processId, err, 'Received a message for unknown process %s. Skipping...', this.name);
                            this.moveMessageToDead(callback);
                            return;
                        }
                        //if (err instanceof ProcessStoppedExceptionV1) {
                        if (this.checkErrorType(err, pip_clients_processstates_node_1.ProcessStoppedExceptionV1)) {
                            this._logger.error(this.processId, err, 'Received a message for inactive process %s. Skipping...', this.name);
                            this.moveMessageToDead(callback);
                            return;
                        }
                        callback(err);
                    });
                }
            });
        });
    }
    postEntityErrorHandler(error, callback) {
        if (error instanceof EntityRequestReviewException_1.EntityRequestReviewException) {
            this._logger.info(this.processId, 'User review was requested for %s', this.name);
            this.requestResponseForProcess(error.message, this.queue.getName(), this.message, (err) => {
                callback(err, true);
            });
            return;
        }
        if (error instanceof EntityPostponeException_1.EntityPostponeException) {
            // On postpone fail the task and request recovery
            var postponeTimeout = this._parameters.getAsIntegerWithDefault(ChangesTransferParam_1.ChangesTransferParam.PostponeTimeout, ChangePostTask.DefaultPostponeTimeout);
            this._logger.info(this.processId, 'Processing of %s was postponed for %s', this.name, postponeTimeout);
            this.failAndRecoverProcess('Processing was postponed - ' + error.message, this.queue.getName(), this.message, postponeTimeout, (err) => {
                callback(err, true);
            });
            return;
        }
        let taskCanceledException = null; // err as TaskCanceledException; - not supported by nodejs
        if (taskCanceledException != null) {
            // On postpone fail the task and request recovery
            var postponeTimeout = this._parameters.getAsIntegerWithDefault(ChangesTransferParam_1.ChangesTransferParam.PostponeTimeout, ChangePostTask.DefaultPostponeTimeout);
            this._logger.info(this.processId, 'Processing of %s was postponed for %s due to %s', this.name, postponeTimeout, taskCanceledException.message);
            this.failAndRecoverProcess('Processing was postponed - ' + taskCanceledException.message, this.queue.getName(), this.message, postponeTimeout, (err) => {
                callback(err || taskCanceledException, true);
            });
            return;
        }
        callback(error, error != null);
    }
    isChangeable(obj) {
        let changeable = obj;
        return changeable.deleted !== undefined || changeable.change_time !== undefined || changeable.create_time !== undefined;
    }
    isIdentifiable(obj) {
        let identifiable = obj;
        return identifiable.id !== undefined;
    }
}
exports.ChangePostTask = ChangePostTask;
ChangePostTask.DefaultPostponeTimeout = 12 * 60 * 1000; // 12h
//# sourceMappingURL=ChangePostTask.js.map