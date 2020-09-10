import { IChangeable } from './IChangeable';
export declare abstract class ChangeableRecord implements IChangeable {
    version?: string;
    create_time: Date;
    change_time: Date;
    deleted: boolean;
}
