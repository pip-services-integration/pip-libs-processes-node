import { INamed } from 'pip-services3-commons-node';
import { Entity } from '../data/Entity';

export class TestEntity extends Entity implements INamed {
    public id: string;
    public name: string;
    public description?: string;
    public categories?: string[];
    public release_date?: Date;
    public msrp?: number;
    public price?: number;
    public color?: string;
    public day?: number;

    public toString(): string {
        return 'Test #' + this.id;
    }
}