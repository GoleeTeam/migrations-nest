import { ModuleMetadata } from '@nestjs/common';
import { FactoryProvider } from '@nestjs/common/interfaces/modules/provider.interface';

export type MigrationsOptions = Pick<ModuleMetadata, 'imports'> & {
    mongoClientToken: string; // TODO implement a compatible way to be used with mongoose
    collectionName: string; // no more default, as a post-incident action!
    maxBatchSize?: number;
    scripts: ScriptProvider[];
    jobs?: JobProvider[];
};

type ScriptProvider = Pick<FactoryProvider, 'useFactory' | 'provide' | 'inject'>;
type JobProvider = Pick<FactoryProvider, 'useFactory' | 'provide' | 'inject'>;
