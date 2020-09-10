import { INamed } from 'pip-services3-commons-node';
import { Entity } from '../data/Entity';
export declare class TestEntity extends Entity implements INamed {
    id: string;
    name: string;
    description?: string;
    categories?: string[];
    release_date?: Date;
    msrp?: number;
    price?: number;
    color?: string;
    day?: number;
    toString(): string;
}
