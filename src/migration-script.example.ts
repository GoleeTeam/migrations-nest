import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MigrationScript } from './module/interfaces/migration-script.abstract';
import { MigrationsModule } from './module/migrations.module';

@Injectable()
export class MigrationsScriptExample extends MigrationScript {
    version = 1;

    constructor(private readonly configService: ConfigService) {
        super();
    }

    public async run(): Promise<void> {
        console.log(`Migration script example executed on environment: ${this.configService.get('ENV_NAME')}`);
        console.log('Migration script example executed!');
        return;
    }
}

// Example of how to use MigrationsModule in your application
MigrationsModule.forRoot({
    mongoClientToken: getMongoToken(),
    imports: [],
    scripts: [
        {
            provide: MigrationsScriptExample,
            useFactory: (config: ConfigService) => {
                return new MigrationsScriptExample(config);
            },
            inject: [ConfigService],
        },
    ],
});

// example of getMongoToken() function
function getMongoToken() {
    return 'MONGO_CLIENT_DEPENDENCY_INJECTION_TOKEN';
}
