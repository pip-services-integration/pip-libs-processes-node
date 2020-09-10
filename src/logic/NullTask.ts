import { Task } from "./Task";

export class NullTask extends Task {
    public execute(callback: (err: any) => void): void {
        this._logger.debug(null, "Received message %s", this.message);
        callback(null);
    }
}