import { DynamicModule, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { IExternalOptions } from "./options";
import {
  MigrationVersion,
  MigrationVersionSchema,
} from "./schemas/migration-version.schema";
import { MigrationRunner } from "./migration-runner.service";
import { MigrationsScripts } from "./migrations-scripts.provider";
import { MigrationVersionRepo } from "./schemas/migration-version.repo";

export const MigrationScriptFactory = (options: IExternalOptions) => {
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
  static forRoot(options: IExternalOptions): DynamicModule {
    const providers = [
      MigrationRunner,
      MigrationVersionRepo,
      ...options.scripts,
      MigrationScriptFactory(options),
    ];
    return {
      imports: [
        // MongooseModule.forRoot(options.mongodb_url),
        MongooseModule.forFeature([
          { name: MigrationVersion.name, schema: MigrationVersionSchema },
        ]),
        ...options.imports,
      ],
      providers: providers as any,
      exports: providers as any,
      module: MigrationsModule,
    };
  }
}
