import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { MigrationsScripts } from "./migrations-scripts.provider";
import { MigrationVersionRepo } from "./schemas/migration-version.repo";

@Injectable()
export class MigrationRunner implements OnModuleInit {
  private readonly logger = new Logger(MigrationRunner.name);

  constructor(
    private migrationVersionRepo: MigrationVersionRepo,
    private migrationsScripts: MigrationsScripts
  ) {}

  async onModuleInit() {
    await this.runMigrations();
  }

  public async runMigrations(): Promise<number[]> {
    const lock = await this.migrationVersionRepo.getMigrationLock();
    if (lock) {
      this.logger.error(
        "Migration db locked, is a migration still in progress?"
      );
      return [];
    }

    const run_migrations = await this.getMigrationsToRun();
    this.logger.debug(`${run_migrations.length} migrations to run`);
    const ok_migrations: any = [];
    for (const migration of run_migrations) {
      try {
        await this.migrationVersionRepo.saveMigrationLock(true);
        await this.migrationsScripts.runMigration(migration);
        await this.migrationVersionRepo.setCurrentVersion(migration);
        await this.migrationVersionRepo.saveMigrationLock(false);
        ok_migrations.push(migration);
      } catch (error) {
        this.logger.error(
          `Migration ${migration} failed no other migrations will be executed`
        );
        await this.migrationVersionRepo.saveMigrationLock(false);
        break;
      }
    }
    return ok_migrations;
  }

  private async getMigrationsToRun(): Promise<number[]> {
    const current_version: number =
      await this.migrationVersionRepo.getCurrentVersion();
    return this.migrationsScripts
      .getAvailableMigrations()
      .filter((_) => _ > current_version);
  }
}
