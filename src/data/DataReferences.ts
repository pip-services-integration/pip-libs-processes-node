import { IDataReferences } from './IDataReferences';

export class DataReferences implements IDataReferences {
    private _data: any = {}; 

    // public getAs<T>(): T[] {
    //     for (let data in this._data.values) {
    //         if (data.length > 0) {
    //             if (data[0] instanceof T)
    //                 return data as T[];
    //         }
    //     }
    //     return []
    // }

    public get(name: string): any[] {
        return this._data[name] || [];
    }

    public set(name: string, data: any[]): void {
        this._data[name] = data;
    }
}