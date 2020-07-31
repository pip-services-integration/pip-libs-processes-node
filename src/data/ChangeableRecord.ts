import { IChangeable } from './IChangeable';

export abstract class ChangeableRecord implements IChangeable {
    public version?: string;
    public create_time: Date;
    public change_time: Date;
    public deleted: boolean;
}