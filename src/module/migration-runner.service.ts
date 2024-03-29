import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MigrationsScriptsProvider } from './migrations-scripts.provider';
import { MigrationVersionRepo } from './repo/migration-version.repo';

@Injectable()
export class MigrationsRunner implements OnModuleInit {
    private readonly logger = new Logger(MigrationsRunner.name);

    constructor(
        private migrationVersionRepo: MigrationVersionRepo,
        private migrationsScripts: MigrationsScriptsProvider,
    ) {}

    async onModuleInit() {
        try {
            void this.runMigrations(); // this is intended not to be awaited in order to not block app bootstrap
        } catch (e: any) {
            this.logger.error(`Unexpected migration error: ${e?.message || e}`);
            this.logger.error(e);
        }
    }

    public async runMigrations(): Promise<number[]> {
        const run_migrations = await this.getMigrationsToRun();
        this.logger.debug(`${run_migrations.length} migrations to run`);

        const ok_migrations: number[] = [];
        for (const migration of run_migrations) {
            try {
                await this.runMigrationAndUpdateVersionRepo(migration);
                ok_migrations.push(migration);
            } catch (error: any) {
                this.logger.error(`Migration ${migration} failed no other migrations will be executed`);
                this.logger.error(error);
                await this.handleErrorAndUpdateVersionRepo(error);
                break;
            }
        }
        return ok_migrations;
    }

    private async runMigrationAndUpdateVersionRepo(migration: number) {
        await this.migrationVersionRepo.saveMigrationLock(true);
        await this.migrationsScripts.runMigration(migration);
        await this.migrationVersionRepo.setCurrentVersion(migration);
        await this.migrationVersionRepo.saveMigrationLock(false);
        await this.migrationVersionRepo.setLastRunCompleted(true);
        await this.migrationVersionRepo.setLastRunError('');
    }

    private async handleErrorAndUpdateVersionRepo(error: any) {
        await this.migrationVersionRepo.saveMigrationLock(false);
        await this.migrationVersionRepo.setLastRunCompleted(false);
        await this.migrationVersionRepo.setLastRunError(error.message || JSON.stringify(error));
    }

    private async getMigrationsToRun(): Promise<number[]> {
        const current_version: number = await this.migrationVersionRepo.getCurrentVersion();

        const lock = await this.migrationVersionRepo.getMigrationLock();
        if (lock) {
            this.logger.warn('Migration db locked, migration is still in progress?');
            const availableConcurrentMigrations = this.migrationsScripts.getAvailableConcurrentMigrationsVersions();

            return onlyCurrentMigration(availableConcurrentMigrations);
        } else {
            return migrationWithHigherVersion(this.migrationsScripts.getAvailableMigrationsVersions());
        }

        function migrationWithHigherVersion(availableMigrations: number[]) {
            return availableMigrations.filter((m) => m > current_version);
        }

        function onlyCurrentMigration(availableConcurrentMigrations: number[]) {
            return availableConcurrentMigrations.filter((m) => m === current_version + 1);
        }
    }
}
