import { DynamicModule, Module } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { MigrationJob } from './interfaces/migration-job.interface';
import { MigrationJobsRunner } from './migration-jobs-runner.service';
import { MigrationsRunner } from './migration-runner.service';
import { MigrationsScriptsProvider } from './migrations-scripts.provider';
import { MigrationsOptions } from './options';
import { MigrationJobStateRepo } from './repo/migration-job-state.repo';
import { MigrationVersionRepo } from './repo/migration-version.repo';

const MigrationScriptFactory = (options: Pick<MigrationsOptions, 'scripts'>) => {
    return {
        provide: MigrationsScriptsProvider,
        useFactory: (...args: any[]) => {
            return new MigrationsScriptsProvider(args);
        },
        inject: options.scripts.map((s) => s.provide),
    };
};

const MigrationVersionRepoFactory = (options: Pick<MigrationsOptions, 'mongoClientToken' | 'collectionName'>) => {
    return {
        provide: MigrationVersionRepo,
        useFactory: (mongoClient: MongoClient) => {
            return new MigrationVersionRepo(mongoClient, options.collectionName);
        },
        inject: [options.mongoClientToken],
    };
};

const MigrationJobRunnerFactory = (
    options: Pick<MigrationsOptions, 'mongoClientToken' | 'collectionName' | 'jobs' | 'maxBatchSize'>,
) => {
    const jobs = options.jobs ?? [];
    return {
        provide: MigrationJobsRunner,
        useFactory: (mongoClient: MongoClient, ...jobInstances: MigrationJob[]) => {
            const stateRepo = new MigrationJobStateRepo(mongoClient, options.collectionName);
            return new MigrationJobsRunner(jobInstances, stateRepo, mongoClient, options.maxBatchSize);
        },
        inject: [options.mongoClientToken, ...jobs.map((j) => j.provide)],
    };
};

@Module({})
export class MigrationsModule {
    static forRoot(options: MigrationsOptions): DynamicModule {
        const jobs = options.jobs ?? [];
        const providers = [
            MigrationsRunner,
            MigrationVersionRepoFactory(options),
            ...options.scripts,
            MigrationScriptFactory(options),
            ...jobs,
            MigrationJobRunnerFactory(options),
        ];
        return {
            imports: [...(options.imports || [])],
            providers: providers as any,
            exports: providers as any,
            module: MigrationsModule,
        };
    }
}
