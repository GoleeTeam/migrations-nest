export interface IMigrationScript {
  version: number;
  supportsConcurrency?: boolean;
  run(): Promise<void>;
}
