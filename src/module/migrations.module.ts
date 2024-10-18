import { DynamicModule, Module } from '@nestjs/common';
import { MigrationsOptions } from './options';
import { MigrationsRunner } from './migration-runner.service';
import { MigrationsScriptsProvider } from './migrations-scripts.provider';
import { MigrationVersionRepo } from './repo/migration-version.repo';

export const MigrationScriptFactory = (options: Pick<MigrationsOptions, 'scripts'>) => {
    return {
        provide: MigrationsScriptsProvider,
        useFactory: (...args: any[]) => {
            return new MigrationsScriptsProvider(args);
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
            imports: [...(options.imports || [])],
            providers: providers as any,
            exports: providers as any,
            module: MigrationsModule,
        };
    }
}
