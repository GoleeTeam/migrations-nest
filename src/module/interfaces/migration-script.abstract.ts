import { IMigrationScript } from './migration-script.interface';
import { paginate } from './paginate';

export abstract class MigrationScript implements IMigrationScript {
    abstract version: number;
    supportsConcurrency? = false;

    abstract run(): Promise<void>;

    protected paginate = paginate;
}
