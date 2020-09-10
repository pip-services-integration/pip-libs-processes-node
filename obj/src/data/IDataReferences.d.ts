export interface IDataReferences {
    get(name: string): any[];
    set(name: string, data: any[]): void;
}
