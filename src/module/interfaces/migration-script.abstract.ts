import { paginate } from "../..";
import { IMigrationScript } from "./migration-script.interface";

export abstract class MigrationScript implements IMigrationScript {
  version: number;
  supportsConcurrency?: boolean;

  abstract run(): Promise<void>;

  protected paginate = paginate;
}
