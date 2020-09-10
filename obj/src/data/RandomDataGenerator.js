"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
class RandomDataGenerator {
    constructor() {
        //this.enums = typeof (T).GetProperties().Where(x => typeof (Enum).IsAssignableFrom(x.PropertyType)).ToArray();
    }
    clone(item) {
        let temp = JSON.stringify(item);
        return JSON.parse(temp);
    }
    distort(item) {
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
    createArray(minSize, maxSize = 0, references) {
        maxSize = Math.max(minSize, maxSize);
        let size = pip_services3_commons_node_1.RandomInteger.nextInteger(minSize, maxSize);
        let items = new Array();
        for (let index = 0; index < size; index++) {
            items.push(this.create(references));
        }
        return items;
    }
    appendArray(items, minSize, maxSize = 0, references) {
        maxSize = Math.max(minSize, maxSize);
        let size = pip_services3_commons_node_1.RandomInteger.nextInteger(minSize, maxSize);
        //items = new Array<T>(items);
        for (let index = 0; index < size; index++) {
            let item = this.create();
            items.push(item);
        }
        return items;
    }
    updateArray(items, minSize, maxSize = 0, references) {
        maxSize = Math.max(minSize, maxSize);
        let size = pip_services3_commons_node_1.RandomInteger.nextInteger(minSize, maxSize);
        //items = new Array<T>(items);
        for (let index = 0; items.length > 0 && index < size; index++) {
            let item = items[pip_services3_commons_node_1.RandomInteger.nextInteger(items.length)];
            this.update(item, references);
        }
        return items;
    }
    reduceArray(items, minSize, maxSize = 0, references) {
        maxSize = Math.max(minSize, maxSize);
        let size = pip_services3_commons_node_1.RandomInteger.nextInteger(minSize, maxSize);
        for (let index = 0; items.length > 0 && index < size; index++) {
            let pos = pip_services3_commons_node_1.RandomInteger.nextInteger(items.length);
            let item = this.delete(items[pos], references);
            if (item == null)
                items.splice(pos, 1);
        }
        return items;
    }
    changeArray(items, minSize, maxSize = 0, references) {
        maxSize = Math.max(minSize, maxSize);
        let size = pip_services3_commons_node_1.RandomInteger.nextInteger(minSize, maxSize);
        //items = new Array<T>(items);
        for (let index = 0; index < size; index++) {
            let choice = pip_services3_commons_node_1.RandomInteger.nextInteger(5);
            if (choice == 1 && items.length > 0) {
                let pos = pip_services3_commons_node_1.RandomInteger.nextInteger(items.length);
                let item = this.delete(items[pos], references);
                if (item == null)
                    items.splice(pos, 1);
            }
            else if (choice == 3) {
                let item = this.create();
                items.push(item);
            }
            else if (items.length > 0) {
                let item = items[pip_services3_commons_node_1.RandomInteger.nextInteger(items.length)];
                this.update(item, references);
            }
        }
        return items;
    }
    distortArray(items, minSize, maxSize = 0, probability = 1, references) {
        maxSize = Math.max(minSize, maxSize);
        let size = pip_services3_commons_node_1.RandomInteger.nextInteger(minSize, maxSize);
        //items = new Array<T>(items);
        for (let index = 0; items.length > 0 && index < size; index++) {
            if (pip_services3_commons_node_1.RandomBoolean.chance(probability * 100, 100)) {
                let itemIndex = pip_services3_commons_node_1.RandomInteger.nextInteger(items.length);
                items[itemIndex] = this.distort(items[itemIndex]);
            }
        }
        return items;
    }
}
exports.RandomDataGenerator = RandomDataGenerator;
//# sourceMappingURL=RandomDataGenerator.js.map