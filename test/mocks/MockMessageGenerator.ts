import { IReferences } from "pip-services3-commons-node";
import { Parameters } from "pip-services3-commons-node";
import { IMessageQueue } from "pip-services3-messaging-node";
import { MessageGenerator } from "../../src/generators/MessageGenerator";

export class MockMessageGenerator extends MessageGenerator {
    public executionNumber: number;

    public constructor(component: string, name: string, queue: IMessageQueue, references: IReferences, parameters: Parameters = null) {
        super(component, name, queue, references, parameters);
        this.executionNumber = 0;
    }

    public beginExecute(callback?: (err: any) => void): void {
        if (!this._started) this.executionNumber++;
        
        super.beginExecute(callback);
    }

    public execute(callback: (err: any) => void): void {
        callback(null);
    }
}