import { MigrationsModule } from './module/migrations.module';
import { IMigrationScript } from './module/interfaces/migration-script.interface';
import { paginate } from './module/interfaces/paginate';
import { MigrationScript } from './module/interfaces/migration-script.abstract';

export { MigrationsModule, IMigrationScript, MigrationScript, paginate };
