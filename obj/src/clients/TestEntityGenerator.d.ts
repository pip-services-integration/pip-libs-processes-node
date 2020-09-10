import { DataReferences } from "../data/DataReferences";
import { TestEntity } from "./TestEntity";
import { RandomDataGenerator } from "../data/RandomDataGenerator";
export declare class TestEntityGenerator extends RandomDataGenerator<TestEntity> {
    categories(): Array<string>;
    create(references?: DataReferences): TestEntity;
    update(entity: TestEntity, references?: DataReferences): TestEntity;
    delete(item: TestEntity, references?: DataReferences): TestEntity;
    distort(item: TestEntity): TestEntity;
}
