import { Task } from "./Task";
export declare class NullTask extends Task {
    execute(callback: (err: any) => void): void;
}
