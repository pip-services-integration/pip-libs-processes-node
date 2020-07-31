import { IStringIdentifiable } from 'pip-services3-commons-node';

export class DataChange<T> implements IStringIdentifiable {
    public id: string;
    public change_time: Date;
    public data: T;
    public change_type: string;
}