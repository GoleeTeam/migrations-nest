import { Injectable, Logger } from "@nestjs/common";
import { IMigrationScript } from "./interfaces/migration-script.interface";

@Injectable()
export class MigrationsScripts {
  private readonly logger = new Logger(MigrationsScripts.name);

  constructor(private readonly migrations: IMigrationScript[]) {
    this.logger.debug(
      `Available migrations: ${this.migrations
        .map((m) => m.constructor.name)
        .join(", ")}`
    );
  }

  public getAvailableMigrationsVersions(): number[] {
    // TODO handle dudplicated versions
    // filter((e, i, a) => a.indexOf(e) !== i)
    const result = this.migrations.map((m) => {
      if (!m.version)
        throw new Error(
          `Migration Script: ${m.constructor.name} must have a 'version' attribute!`
        );
      return m.version;
    });
    const numericCompare = (a, b) => a - b;
    return result.sort(numericCompare);
  }

  public async runMigration(migrationToRun: number): Promise<any> {
    try {
      this.logger.log(`Migration script ${migrationToRun} run start.`);
      await this.migrations
        .filter((m) => m.version === migrationToRun)[0]
        .run();
      this.logger.log(`Migration script ${migrationToRun} run finished.`);
    } catch (e: any) {
      this.logger.error(
        `Migration script ${migrationToRun} failed with ${e.message || e}`
      );
      throw e;
    }
  }
}
