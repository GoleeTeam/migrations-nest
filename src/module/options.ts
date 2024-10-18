import { ModuleMetadata } from '@nestjs/common';
import { FactoryProvider } from '@nestjs/common/interfaces/modules/provider.interface';

export type MigrationsOptions = Pick<ModuleMetadata, 'imports'> & {
    mongoClientToken: string; // TODO implement a compatible way to be used with mongoose
    collectionName?: string; // default is migrations_version
    scripts: ScriptProvider[];
};

type ScriptProvider = Pick<FactoryProvider, 'useFactory' | 'provide' | 'inject'>;
