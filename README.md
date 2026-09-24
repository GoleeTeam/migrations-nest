# Migrations Nest

The library supports two types of database operations:

- **migration scripts** run automatically at application startup, once and in version order;
- **migration jobs** process MongoDB documents in batches and run only when explicitly requested.

Both store their state in the collection configured through `collectionName`.

## Migration script

Extend `MigrationScript`, assign a unique version, and implement `run()`:

```typescript
import { MigrationScript } from '@golee/migrations-nest';

export class AddProfileStatus extends MigrationScript {
    version = 1;

    constructor(private readonly profiles: ProfilesRepository) {
        super();
    }

    async run(): Promise<void> {
        await this.profiles.addMissingStatus();
    }
}
```

Scripts are registered in `MigrationsModule`. Versions greater than the persisted version run automatically during module initialization:

```typescript
MigrationsModule.forRoot({
    mongoClientToken: 'MONGO_CLIENT',
    collectionName: 'migrations',
    imports: [ProfilesModule],
    scripts: [
        {
            provide: AddProfileStatus,
            useFactory: (profiles: ProfilesRepository) => new AddProfileStatus(profiles),
            inject: [ProfilesRepository],
        },
    ],
});
```

## On-request migration job

A job defines the source collection and processes one batch at a time. Source documents must use MongoDB `ObjectId` values as `_id`.

```typescript
import { MigrationJob, MigrationJobBatchResult } from '@golee/migrations-nest';
import { Document, WithId } from 'mongodb';

export class RebuildProfileProjection implements MigrationJob {
    name = 'rebuild-profile-projection';
    collectionName = 'profiles';
    filter = { deleted: false };

    constructor(private readonly projection: ProfilesProjection) {}

    async processBatch(docs: WithId<Document>[]): Promise<MigrationJobBatchResult> {
        const failures: MigrationJobBatchResult['failures'] = [];

        for (const doc of docs) {
            try {
                await this.projection.rebuild(doc);
            } catch (error) {
                failures.push({
                    itemId: doc._id.toString(),
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        return { failures };
    }
}
```

Register jobs alongside scripts:

```typescript
MigrationsModule.forRoot({
    mongoClientToken: 'MONGO_CLIENT',
    collectionName: 'migrations',
    maxBatchSize: 5000, // optional, defaults to 10 000
    imports: [ProfilesModule],
    scripts: [],
    jobs: [
        {
            provide: RebuildProfileProjection,
            useFactory: (projection: ProfilesProjection) => new RebuildProfileProjection(projection),
            inject: [ProfilesProjection],
        },
    ],
});
```

Inject `MigrationJobsRunner` into an application service or controller and request the next batch:

```typescript
import { MigrationJobsRunner } from '@golee/migrations-nest';
import { Body, Controller, Param, Post } from '@nestjs/common';

class RunNextBatchDto {
    batchSize: number;
}

@Controller('migration-jobs')
export class MigrationJobsController {
    constructor(private readonly migrationJobs: MigrationJobsRunner) {}

    @Post(':jobName/next-batch')
    runNextBatch(@Param('jobName') jobName: string, @Body() body: RunNextBatchDto) {
        return this.migrationJobs.runNextBatch(jobName, body.batchSize);
    }

    @Get(':jobName/status')
    getJobStatus(@Param('jobName') jobName: string) {
        return this.migrationJobs.getJobStatus(jobName);
    }
}
```

The runner:

- reads at most `batchSize` documents in ascending `_id` order;
- rejects `batchSize` above `maxBatchSize` (default `10 000`) with `InvalidBatchSizeError`;
- resumes after the persisted `lastProcessedId`;
- prevents concurrent execution of the same job;
- returns attempted, succeeded, failed, total, and remaining counts, an integer `progressPercentage` from 0 to 100,
  and the current batch's `itemsPerMinute`;
- persists the last-run snapshot so `getJobStatus(jobName)` can return it without re-querying the source collection;
- reports a human-readable `estimatedRemainingProcessingTime` based on the latest batch throughput;
- advances past failures returned by `processBatch`;
- preserves the previous checkpoint when `processBatch` throws.

Jobs use `secondaryPreferred` by default. Set `readPreference` to change it. The optional `filter` limits which source
documents are counted and processed; the example above excludes deleted profiles with `{ deleted: false }`.
