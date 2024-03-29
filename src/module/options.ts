import { ModuleMetadata } from '@nestjs/common';
import { FactoryProvider } from '@nestjs/common/interfaces/modules/provider.interface';

export type MigrationsOptions = Pick<ModuleMetadata, 'imports'> & {
    mongoDbConnectionName?: string;
    scripts: ScriptProvider[];
};

type ScriptProvider = Pick<FactoryProvider, 'useFactory' | 'provide' | 'inject'>;
