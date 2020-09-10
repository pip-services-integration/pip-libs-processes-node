"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Task_1 = require("./Task");
class NullTask extends Task_1.Task {
    execute(callback) {
        this._logger.debug(null, "Received message %s", this.message);
        callback(null);
    }
}
exports.NullTask = NullTask;
//# sourceMappingURL=NullTask.js.map