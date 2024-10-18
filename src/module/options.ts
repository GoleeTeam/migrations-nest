import { ModuleMetadata } from '@nestjs/common';
import { FactoryProvider } from '@nestjs/common/interfaces/modules/provider.interface';
import { MongoClient } from 'mongodb';

export type MigrationsOptions = Pick<ModuleMetadata, 'imports'> & {
    mongoConn: MongoClient;
    collectionName?: string; // TODO implement custom collection name
    scripts: ScriptProvider[];
};

type ScriptProvider = Pick<FactoryProvider, 'useFactory' | 'provide' | 'inject'>;
