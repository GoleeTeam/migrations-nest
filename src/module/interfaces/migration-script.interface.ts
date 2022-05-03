export interface IMigrationScript {
  version: number;
  run: () => Promise<void>;
}
