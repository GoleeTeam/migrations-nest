import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MigrationsOptions } from './options';
import { MigrationVersion, MigrationVersionSchema } from './schemas/migration-version.schema';
import { MigrationsRunner } from './migration-runner.service';
import { MigrationsScripts } from './migrations-scripts.provider';
import { MigrationVersionRepo } from './schemas/migration-version.repo';

export const MigrationScriptFactory = (options: Pick<MigrationsOptions, 'scripts'>) => {
    return {
        provide: MigrationsScripts,
        useFactory: (...args: any[]) => {
            return new MigrationsScripts(args);
        },
        inject: options.scripts.map((s) => s.provide),
    };
};

@Module({})
export class MigrationsModule {
    private static MIGRATIONS_MODULE_OPTIONS_TOKEN = 'MIGRATIONS_MODULE_OPTIONS';

    static forRoot(options: MigrationsOptions): DynamicModule {
        const providers = [MigrationsRunner, MigrationVersionRepo, ...options.scripts, MigrationScriptFactory(options)];
        return {
            imports: [
                MongooseModule.forFeature(
                    [
                        {
                            name: MigrationVersion.name,
                            schema: MigrationVersionSchema,
                        },
                    ],
                    options.mongoDbConnectionName,
                ),
                ...(options.imports || []),
            ],
            providers: providers as any,
            exports: providers as any,
            module: MigrationsModule,
        };
    }
}
