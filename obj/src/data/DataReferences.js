"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataReferences = void 0;
class DataReferences {
    constructor() {
        this._data = {};
    }
    // public getAs<T>(): T[] {
    //     for (let data in this._data.values) {
    //         if (data.length > 0) {
    //             if (data[0] instanceof T)
    //                 return data as T[];
    //         }
    //     }
    //     return []
    // }
    get(name) {
        return this._data[name] || [];
    }
    set(name, data) {
        this._data[name] = data;
    }
}
exports.DataReferences = DataReferences;
//# sourceMappingURL=DataReferences.js.map