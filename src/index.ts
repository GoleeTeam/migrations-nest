import { MigrationScript } from './module/interfaces/migration-script.abstract';
import { IMigrationScript } from './module/interfaces/migration-script.interface';
import { paginate } from './module/interfaces/paginate';
import { MigrationsModule } from './module/migrations.module';
import { MigrationsOptions } from './module/options';

export { IMigrationScript, MigrationScript, MigrationsModule, MigrationsOptions, paginate };
