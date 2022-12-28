import { paginate } from "../..";
import { IMigrationScript } from "./migration-script.interface";

export abstract class MigrationScript implements IMigrationScript {
  version: number;
  supportsConcurrency?: boolean;
  run: () => Promise<void>;

  private paginate = paginate;
}
