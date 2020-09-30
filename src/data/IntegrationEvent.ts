import { Entity } from "./Entity";

export class IntegrationEvent extends Entity {
    public type: string;
    public object_type: string;
    public object_value: string;
    public details: string;

    public setObject<T>(obj: T) {
        // Include type information when serializing JSON 
        this.object_type = this.getTypeName<T>();
        this.object_value = JSON.stringify(obj);
    }

    public getObject<T>(): T {
        return JSON.parse(this.object_value) as T;
    }

    private getTypeName<T>(): string {
        var TCtor: new (...args: any[]) => T;
        var typeName = typeof (TCtor).name;

        return typeName;
    }
} 