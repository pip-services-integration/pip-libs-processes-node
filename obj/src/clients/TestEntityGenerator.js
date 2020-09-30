"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestEntityGenerator = void 0;
const pip_services3_commons_node_1 = require("pip-services3-commons-node");
const RandomDataGenerator_1 = require("../data/RandomDataGenerator");
class TestEntityGenerator extends RandomDataGenerator_1.RandomDataGenerator {
    categories() {
        let categories = new Array();
        let size = pip_services3_commons_node_1.RandomInteger.nextInteger(1, 4);
        for (var index = 0; index < size; index++)
            categories.push(pip_services3_commons_node_1.RandomText.verb());
        return categories;
    }
    create(references) {
        let utcNow = new Date();
        let entity = {
            id: pip_services3_commons_node_1.IdGenerator.nextLong(),
            name: pip_services3_commons_node_1.RandomText.phrase(25, 100),
            description: pip_services3_commons_node_1.RandomText.text(50, 250),
            categories: this.categories(),
            release_date: pip_services3_commons_node_1.RandomDateTime.nextDate(utcNow),
            msrp: pip_services3_commons_node_1.RandomInteger.nextInteger(10, 500),
            color: pip_services3_commons_node_1.RandomArray.pick(["red", "green", "blue", "orange"]),
            day: pip_services3_commons_node_1.RandomInteger.nextInteger(1, 8),
            create_time: utcNow,
            change_time: utcNow,
            deleted: false
        };
        entity.price = pip_services3_commons_node_1.RandomFloat.updateFloat(entity.msrp);
        return entity;
    }
    update(entity, references) {
        var utcNow = new Date();
        if (pip_services3_commons_node_1.RandomBoolean.chance(1, 4))
            entity.name = pip_services3_commons_node_1.RandomText.phrase(25, 100);
        else if (pip_services3_commons_node_1.RandomBoolean.chance(1, 4))
            entity.description = pip_services3_commons_node_1.RandomText.text(50, 250);
        else if (pip_services3_commons_node_1.RandomBoolean.chance(1, 4))
            entity.price = pip_services3_commons_node_1.RandomFloat.updateFloat(entity.price);
        else
            entity.categories = this.categories();
        entity.change_time = utcNow;
        return entity;
    }
    delete(item, references) {
        // Logical deletion
        item.deleted = true;
        item.change_time = new Date();
        return item;
    }
    distort(item) {
        if (pip_services3_commons_node_1.RandomBoolean.chance(1, 5))
            item.id = null;
        else if (pip_services3_commons_node_1.RandomBoolean.chance(1, 5))
            item.id = pip_services3_commons_node_1.IdGenerator.nextLong();
        else if (pip_services3_commons_node_1.RandomBoolean.chance(1, 5))
            item.name = null;
        else if (pip_services3_commons_node_1.RandomBoolean.chance(1, 5))
            item.change_time = new Date();
        else if (pip_services3_commons_node_1.RandomBoolean.chance(1, 5))
            item.create_time = new Date();
        return super.distort(item);
    }
}
exports.TestEntityGenerator = TestEntityGenerator;
//# sourceMappingURL=TestEntityGenerator.js.map