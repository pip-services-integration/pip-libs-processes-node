import { IStringIdentifiable } from 'pip-services3-commons-node';
import { IChangeable } from './IChangeable';

export abstract class Entity implements IStringIdentifiable, IChangeable {
    public id: string;
    public version?: string;
    public create_time: Date;
    public change_time: Date;
    public deleted: boolean;
}