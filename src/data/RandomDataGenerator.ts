import { DataReferences } from "./DataReferences";
import { RandomInteger, RandomBoolean, IChangeable } from "pip-services3-commons-node";

export abstract class RandomDataGenerator<T> {

    public abstract create(references?: DataReferences);
    public abstract update(item: T, references?: DataReferences);
    public abstract delete(item: T, references?: DataReferences);

    public enums: Array<any>;

    public constructor() {
        //this.enums = typeof (T).GetProperties().Where(x => typeof (Enum).IsAssignableFrom(x.PropertyType)).ToArray();
    }

    public clone(item: T) {
        let temp = JSON.stringify(item);
        return JSON.parse(temp);
    }

    public distort(item: any) {
        // if (item is IChangeable)
        // {
        //     if (RandomBoolean.chance(2, 5))
        //         (item as IChangeable).change_time = new Date();
        //     else if (RandomBoolean.chance(2, 5))
        //         (item as IChangeable).change_time = new Date();
        // }

        // if (this.enums.length > 0) {
        //     if (RandomBoolean.chance(1, 5)) {
        //         let prop: PropertyInfo = this.enums[RandomInteger.nextInteger(this.enums.length)];
        //         let values: any = prop.PropertyType.getEnumValues();
        //         prop.setValue(item, values.getValue(RandomInteger.nextInteger(values.Length)));
        //     }
        // }

        return item;
    }

    public createArray(minSize: number, maxSize: number = 0, references?: DataReferences): Array<T> {
        maxSize = Math.max(minSize, maxSize);
        let size = RandomInteger.nextInteger(minSize, maxSize);
        let items: Array<T> = new Array<T>();

        for (let index = 0; index < size; index++) {
            items.push(this.create(references));
        }

        return items;
    }

    public appendArray(items: Array<T>, minSize: number, maxSize: number = 0, references?: DataReferences): Array<T> {
        maxSize = Math.max(minSize, maxSize);
        let size = RandomInteger.nextInteger(minSize, maxSize);
        //items = new Array<T>(items);

        for (let index = 0; index < size; index++) {
            let item = this.create();
            items.push(item);
        }

        return items;
    }

    public updateArray(items: Array<T>, minSize: number, maxSize: number = 0, references?: DataReferences): Array<T> {
        maxSize = Math.max(minSize, maxSize);
        let size = RandomInteger.nextInteger(minSize, maxSize);
        //items = new Array<T>(items);

        for (let index = 0; items.length > 0 && index < size; index++) {
            let item = items[RandomInteger.nextInteger(items.length)];
            this.update(item, references);
        }

        return items;
    }

    public reduceArray(items: Array<T>, minSize: number, maxSize: number = 0, references?: DataReferences): Array<T> {
        maxSize = Math.max(minSize, maxSize);
        let size = RandomInteger.nextInteger(minSize, maxSize);

        for (let index = 0; items.length > 0 && index < size; index++) {
            let pos = RandomInteger.nextInteger(items.length);
            let item = this.delete(items[pos], references);
            if (item == null) items.splice(pos, 1);
        }

        return items;
    }

    public changeArray(items: Array<T>, minSize: number, maxSize: number = 0, references?: DataReferences): Array<T> {
        maxSize = Math.max(minSize, maxSize);
        let size = RandomInteger.nextInteger(minSize, maxSize);
        //items = new Array<T>(items);

        for (let index = 0; index < size; index++) {
            let choice = RandomInteger.nextInteger(5);
            if (choice == 1 && items.length > 0) {
                let pos = RandomInteger.nextInteger(items.length);
                let item = this.delete(items[pos], references);
                if (item == null) items.splice(pos, 1);
            }
            else if (choice == 3) {
                let item = this.create();
                items.push(item);
            }
            else if (items.length > 0) {
                let item = items[RandomInteger.nextInteger(items.length)];
                this.update(item, references);
            }
        }

        return items;
    }

    public distortArray(items: Array<T>, minSize: number, maxSize: number = 0, probability: number = 1, references?: DataReferences): Array<T> {
        maxSize = Math.max(minSize, maxSize);
        let size = RandomInteger.nextInteger(minSize, maxSize);
        //items = new Array<T>(items);

        for (let index = 0; items.length > 0 && index < size; index++) {
            if (RandomBoolean.chance(probability * 100, 100)) {
                let itemIndex = RandomInteger.nextInteger(items.length);
                items[itemIndex] = this.distort(items[itemIndex]);
            }
        }

        return items;
    }

}