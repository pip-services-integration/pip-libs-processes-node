import { Entity } from "./Entity";
export declare class IntegrationEvent extends Entity {
    type: string;
    object_type: string;
    object_value: string;
    details: string;
    setObject<T>(obj: T): void;
    getObject<T>(): T;
    private getTypeName;
}
