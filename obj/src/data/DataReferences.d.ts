import { IDataReferences } from './IDataReferences';
export declare class DataReferences implements IDataReferences {
    private _data;
    get(name: string): any[];
    set(name: string, data: any[]): void;
}
