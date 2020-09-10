import { DataReferences } from "./DataReferences";
export declare abstract class RandomDataGenerator<T> {
    abstract create(references?: DataReferences): any;
    abstract update(item: T, references?: DataReferences): any;
    abstract delete(item: T, references?: DataReferences): any;
    enums: Array<any>;
    constructor();
    clone(item: T): any;
    distort(item: any): any;
    createArray(minSize: number, maxSize?: number, references?: DataReferences): Array<T>;
    appendArray(items: Array<T>, minSize: number, maxSize?: number, references?: DataReferences): Array<T>;
    updateArray(items: Array<T>, minSize: number, maxSize?: number, references?: DataReferences): Array<T>;
    reduceArray(items: Array<T>, minSize: number, maxSize?: number, references?: DataReferences): Array<T>;
    changeArray(items: Array<T>, minSize: number, maxSize?: number, references?: DataReferences): Array<T>;
    distortArray(items: Array<T>, minSize: number, maxSize?: number, probability?: number, references?: DataReferences): Array<T>;
}
