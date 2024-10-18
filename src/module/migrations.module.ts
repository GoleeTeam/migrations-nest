import { DynamicModule, Module } from '@nestjs/common';
import { MigrationsOptions } from './options';
import { MigrationsRunner } from './migration-runner.service';
import { MigrationsScriptsProvider } from './migrations-scripts.provider';
import { MigrationVersionRepo } from './repo/migration-version.repo';
import { MongoClient } from 'mongodb';

export const MigrationScriptFactory = (options: Pick<MigrationsOptions, 'scripts'>) => {
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

@Module({})
export class MigrationsModule {
    private static MIGRATIONS_MODULE_OPTIONS_TOKEN = 'MIGRATIONS_MODULE_OPTIONS';

    static forRoot(options: MigrationsOptions): DynamicModule {
        const providers = [
            MigrationsRunner,
            MigrationVersionRepoFactory(options),
            ...options.scripts,
            MigrationScriptFactory(options),
        ];
        return {
            imports: [...(options.imports || [])],
            providers: providers as any,
            exports: providers as any,
            module: MigrationsModule,
        };
    }
}
