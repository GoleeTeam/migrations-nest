import { Injectable, Logger } from '@nestjs/common';
import { DuplicateMigrationVersionsError, MissingMigrationVersionError } from './errors/migration.errors';
import { IMigrationScript } from './interfaces/migration-script.interface';

@Injectable()
export class MigrationsScriptsProvider {
    private readonly logger = new Logger(MigrationsScriptsProvider.name);

    constructor(private readonly migrations: IMigrationScript[]) {
        this.logger.debug(`Available migrations: ${this.migrations.map((m) => m.constructor.name).join(', ')}`);
    }

    public getAvailableMigrationsVersions(): number[] {
        this.checkDuplicatedVersions();
        return this.getSortedVersions();
    }

    private checkDuplicatedVersions() {
        const duplicatedVersions = this.getScriptsWithDuplicatedVersion();
        if (duplicatedVersions.length) {
            throw new DuplicateMigrationVersionsError(duplicatedVersions);
        }
    }

    private getScriptsWithDuplicatedVersion() {
        return this.getVersions().filter((e, i, a) => a.indexOf(e) !== i);
    }

    private getSortedVersions(): number[] {
        const numericCompare = (a: number, b: number) => a - b;
        return this.getVersions().sort(numericCompare);
    }

    private getVersions(): number[] {
        return this.migrations.map((m) => {
            if (!m.version) throw new MissingMigrationVersionError(m.constructor.name);
            return m.version;
        });
    }

    public getAvailableConcurrentMigrationsVersions(): number[] {
        return this.filterMigrationsThatSupportConcurrency(this.getAvailableMigrationsVersions());
    }

    private filterMigrationsThatSupportConcurrency(availableMigrations: number[]) {
        return availableMigrations.filter((version) => {
            return this.migrations.find((m) => m.version === version)?.supportsConcurrency;
        });
    }

    public async runMigration(migrationToRun: number): Promise<void> {
        const migrationScriptToRun = this.migrations.find((m) => m.version === migrationToRun);
        if (!migrationScriptToRun) {
            return;
        }
        try {
            this.logger.log(`Migration script version: ${migrationScriptToRun.version} run start.`);
            await migrationScriptToRun.run();
            this.logger.log(`Migration script ${migrationScriptToRun.version} run finished.`);
        } catch (e: any) {
            this.logger.error(`Migration script ${migrationScriptToRun.version} failed with ${e.message || e}`);
            throw e;
        }
    }
}
