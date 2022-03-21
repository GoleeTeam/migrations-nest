import { Injectable, Logger } from "@nestjs/common";
import { IMigrationScript } from "./interfaces/migration-script.interface";

export class MigrationsScripts {
  constructor(private readonly migrations: IMigrationScript[]) {
    this.logger.debug(
      `Available migrations: ${this.migrations
        .map((m) => m.constructor.name)
        .join(", ")}`
    );
  }

  private readonly logger = new Logger(MigrationsScripts.name);

  public getAvailableMigrations(): number[] {
    return this.migrations.map((e, i) => i + 1);
  }

  public async runMigration(migration: number): Promise<any> {
    try {
      this.logger.log(`Migration script ${migration} run start.`);
      await this.migrations[migration - 1].run();
      this.logger.log(`Migration script ${migration} run finished.`);
    } catch (e: any) {
      this.logger.error(
        `Migration script ${migration} failed with ${e.message || e}`
      );
      throw e;
    }
  }
}
