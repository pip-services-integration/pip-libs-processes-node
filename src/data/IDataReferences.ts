export interface IDataReferences {
    // getAs<T>(): T[];
    get(name: string): any[];
    set(name: string, data: any[]): void;
}