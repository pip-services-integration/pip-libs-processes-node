import { RandomInteger, RandomText, RandomFloat, IdGenerator, RandomDateTime, RandomArray, RandomBoolean } from "pip-services3-commons-node";
import { DataReferences } from "../data/DataReferences";
import { TestEntity } from "./TestEntity";
import { RandomDataGenerator } from "../data/RandomDataGenerator";

export class TestEntityGenerator extends RandomDataGenerator<TestEntity> {

    public categories(): Array<string> {
        let categories: Array<string> = new Array<string>();
        let size = RandomInteger.nextInteger(1, 4);
        for (var index = 0; index < size; index++)
            categories.push(RandomText.verb());
        return categories;
    }

    public create(references?: DataReferences): TestEntity {
        let utcNow = new Date();
        let entity: TestEntity = <TestEntity>{
            id: IdGenerator.nextLong(),
            name: RandomText.phrase(25, 100),
            description: RandomText.text(50, 250),
            categories: this.categories(),
            release_date: RandomDateTime.nextDate(utcNow),
            msrp: RandomInteger.nextInteger(10, 500),
            color: RandomArray.pick(["red", "green", "blue", "orange"]),
            day: RandomInteger.nextInteger(1, 8)
        };

        entity.price = RandomFloat.updateFloat(entity.msrp);
        return entity;
    }

    public update(entity: TestEntity, references?: DataReferences): TestEntity {
        var utcNow = new Date();

        if (RandomBoolean.chance(1, 4))
            entity.name = RandomText.phrase(25, 100);
        else if (RandomBoolean.chance(1, 4))
            entity.description = RandomText.text(50, 250);
        else if (RandomBoolean.chance(1, 4))
            entity.price = RandomFloat.updateFloat(entity.price);
        else
            entity.categories = this.categories();

        entity.change_time = utcNow;

        return entity;
    }

    public delete(item: TestEntity, references?: DataReferences): TestEntity {
        // Logical deletion
        //item.is_deleted = true;
        item.change_time = new Date();
        return item;
    }

    public distort(item: TestEntity): TestEntity {
        if (RandomBoolean.chance(1, 5))
            item.id = null;
        else if (RandomBoolean.chance(1, 5))
            item.id = IdGenerator.nextLong();
        else if (RandomBoolean.chance(1, 5))
            item.name = null;
        else if (RandomBoolean.chance(1, 5))
            item.change_time = new Date();
        else if (RandomBoolean.chance(1, 5))
            item.create_time = new Date();

        return super.distort(item);
    }
}