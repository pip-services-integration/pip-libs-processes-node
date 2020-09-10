import { IStringIdentifiable } from 'pip-services3-commons-node';
import { IChangeable } from './IChangeable';
export declare abstract class Entity implements IStringIdentifiable, IChangeable {
    id: string;
    version?: string;
    create_time: Date;
    change_time: Date;
    deleted: boolean;
}
