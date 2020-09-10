import { IStringIdentifiable } from 'pip-services3-commons-node';
export declare class DataChange<T> implements IStringIdentifiable {
    id: string;
    change_time: Date;
    data: T;
    change_type: string;
}
