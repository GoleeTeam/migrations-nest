import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MongoClient, ObjectId } from 'mongodb';
import { InvalidRequestedCountError, JobAlreadyRunningError, JobNotFoundError } from './errors/migration.errors';
import { JobFailure, MigrationJob, MigrationJobChunkResult } from './interfaces/migration-job.interface';
import { MigrationJobStateRepo } from './repo/migration-job-state.repo';

@Injectable()
export class MigrationJobsRunner implements OnModuleInit {
    private readonly logger = new Logger(MigrationJobsRunner.name);

    constructor(
        private readonly jobs: MigrationJob[],
        private readonly repo: MigrationJobStateRepo,
        private readonly mongoClient: MongoClient,
    ) {}

    async onModuleInit(): Promise<void> {
        await this.repo.init();
    }

    async runNextChunk(jobName: string, requestedCount: number): Promise<MigrationJobChunkResult> {
        if (!Number.isInteger(requestedCount) || requestedCount <= 0) {
            throw new InvalidRequestedCountError(requestedCount);
        }

        const job = this.jobs.find((j) => j.name === jobName);
        if (!job) {
            throw new JobNotFoundError(jobName);
        }

        const lockAcquired = await this.repo.tryAcquireLock(jobName);
        if (!lockAcquired) {
            throw new JobAlreadyRunningError(jobName);
        }

        try {
            return await this.executeChunk(job, jobName, requestedCount);
        } catch (error: any) {
            await this.repo.saveError(jobName, error.message || String(error));
            throw error;
        } finally {
            await this.repo.releaseLock(jobName);
        }
    }

    private async executeChunk(
        job: MigrationJob,
        jobName: string,
        requestedCount: number,
    ): Promise<MigrationJobChunkResult> {
        const collection = this.mongoClient.db().collection(job.collectionName);
        const filter = job.filter ?? {};
        const readPreference = job.readPreference ?? 'secondaryPreferred';

        const lastProcessedId = await this.repo.getLastProcessedId(jobName);
        const batchFilter = lastProcessedId ? { ...filter, _id: { $gt: lastProcessedId } } : filter;

        const [totalItemsCount, batch] = await Promise.all([
            collection.countDocuments(filter, { readPreference }),
            collection.find(batchFilter, { readPreference }).sort({ _id: 1 }).limit(requestedCount).toArray(),
        ]);

        let failures: JobFailure[] = [];
        let extra: unknown;

        if (batch.length > 0) {
            const result = await job.processBatch(batch, requestedCount);
            failures = result.failures;
            extra = result.extra;
        }

        const newLastProcessedId = batch.length > 0 ? (batch[batch.length - 1]._id as ObjectId) : lastProcessedId;

        const remainingItemsCount =
            newLastProcessedId !== null
                ? await collection.countDocuments({ ...filter, _id: { $gt: newLastProcessedId } }, { readPreference })
                : 0;

        await this.repo.saveProgress(jobName, newLastProcessedId, requestedCount);

        this.logger.log(
            `Job "${jobName}" chunk: attempted=${batch.length}, failed=${failures.length}, ` +
                `total=${totalItemsCount}, remaining=${remainingItemsCount}`,
        );

        return {
            jobName,
            requestedCount,
            attemptedCount: batch.length,
            succeededCount: batch.length - failures.length,
            failedCount: failures.length,
            failures,
            totalItemsCount,
            remainingItemsCount,
            extra,
        };
    }
}
