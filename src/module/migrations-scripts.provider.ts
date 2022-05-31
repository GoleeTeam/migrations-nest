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
    this.checkDuplicatedVersions();
    return this.getSortedVersions();
  }

  private checkDuplicatedVersions() {
    if (this.getScriptsWithDuplicatedVersion().length) {
      throw new Error(
        `Duplicated Scripts for versions: ${this.getScriptsWithDuplicatedVersion()}`
      );
    }
  }

  private getScriptsWithDuplicatedVersion() {
    return this.getVersions().filter((e, i, a) => a.indexOf(e) !== i);
  }

  private getVersions(): number[] {
    return this.migrations.map((m) => {
      if (!m.version)
        throw new Error(
          `Migration Script: ${m.constructor.name} must have a 'version' attribute!`
        );
      return m.version;
    });
  }

  private getSortedVersions(): number[] {
    const numericCompare = (a, b) => a - b;
    return this.getVersions().sort(numericCompare);
  }

  public async runMigration(migrationToRun: number): Promise<any> {
    try {
      this.logger.log(`Migration script ${migrationToRun} run start.`);
      await this.migrations.find((m) => m.version === migrationToRun).run();
      this.logger.log(`Migration script ${migrationToRun} run finished.`);
    } catch (e: any) {
      this.logger.error(
        `Migration script ${migrationToRun} failed with ${e.message || e}`
      );
      throw e;
    }
  }
}
