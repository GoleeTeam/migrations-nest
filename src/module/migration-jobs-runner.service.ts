import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MongoClient, ObjectId } from 'mongodb';
import { InvalidBatchSizeError, JobAlreadyRunningError, JobNotFoundError } from './errors/migration.errors';
import {
    MigrationJob,
    MigrationJobItemFailure,
    MigrationJobRunResult,
    MigrationJobStatus,
} from './interfaces/migration-job.interface';
import { MigrationJobStateRepo } from './repo/migration-job-state.repo';

const DEFAULT_MAX_BATCH_SIZE = 10_000;

@Injectable()
export class MigrationJobsRunner implements OnModuleInit {
    private readonly logger = new Logger(MigrationJobsRunner.name);

    constructor(
        private readonly jobs: MigrationJob[],
        private readonly stateRepo: MigrationJobStateRepo,
        private readonly mongoClient: MongoClient,
        private readonly maxBatchSize: number = DEFAULT_MAX_BATCH_SIZE,
    ) {}

    async onModuleInit(): Promise<void> {
        await this.stateRepo.init();
    }

    async runNextBatch(jobName: string, batchSize: number): Promise<MigrationJobRunResult> {
        this.validateBatchSize(batchSize);

        const job = this.jobs.find((j) => j.name === jobName);
        if (!job) {
            throw new JobNotFoundError(jobName);
        }

        const lockAcquired = await this.stateRepo.tryAcquireLock(jobName);
        if (!lockAcquired) {
            throw new JobAlreadyRunningError(jobName);
        }

        try {
            return await this.executeBatch(job, jobName, batchSize);
        } catch (error: any) {
            await this.stateRepo.saveError(jobName, error.message || String(error));
            throw error;
        } finally {
            await this.stateRepo.releaseLock(jobName);
        }
    }

    private validateBatchSize(batchSize: number): void {
        if (!Number.isInteger(batchSize) || batchSize <= 0) {
            throw new InvalidBatchSizeError(batchSize);
        }
        if (batchSize > this.maxBatchSize) {
            throw new InvalidBatchSizeError(batchSize, this.maxBatchSize);
        }
    }

    async getJobStatus(jobName: string): Promise<MigrationJobStatus> {
        const job = this.jobs.find((j) => j.name === jobName);
        if (!job) {
            throw new JobNotFoundError(jobName);
        }

        const doc = await this.stateRepo.getStatus(jobName);
        if (!doc) {
            return {
                jobName,
                lock: false,
                lastRunError: '',
                attemptedCount: null,
                succeededCount: null,
                failedCount: null,
                totalCount: null,
                remainingCount: null,
                progressPercentage: 0,
                averageItemProcessingTimeMs: null,
            };
        }

        return {
            jobName,
            lock: doc.lock,
            lastRunError: doc.lastRunError,
            attemptedCount: doc.attemptedCount,
            succeededCount: doc.succeededCount,
            failedCount: doc.failedCount,
            totalCount: doc.totalCount,
            remainingCount: doc.remainingCount,
            progressPercentage: doc.progressPercentage ?? 0,
            averageItemProcessingTimeMs: doc.averageItemProcessingTimeMs,
        };
    }

    private async executeBatch(job: MigrationJob, jobName: string, batchSize: number): Promise<MigrationJobRunResult> {
        const collection = this.mongoClient.db().collection(job.collectionName);
        const filter = job.filter ?? {};
        const readPreference = job.readPreference ?? 'secondaryPreferred';
        const lastProcessedId = await this.stateRepo.getLastProcessedId(jobName);
        const batchFilter = lastProcessedId ? { ...filter, _id: { $gt: lastProcessedId } } : filter;

        const [totalCount, batch] = await Promise.all([
            collection.countDocuments(filter, { readPreference }),
            collection.find(batchFilter, { readPreference }).sort({ _id: 1 }).limit(batchSize).toArray(),
        ]);

        let failures: MigrationJobItemFailure[] = [];
        let extra: unknown;
        let averageItemProcessingTimeMs: number | null = null;

        if (batch.length > 0) {
            const processingStartedAt = process.hrtime.bigint();
            const result = await job.processBatch(batch);
            const processingTimeMs = Number(process.hrtime.bigint() - processingStartedAt) / 1_000_000;
            averageItemProcessingTimeMs = Math.round((processingTimeMs / batch.length) * 100) / 100;
            failures = result.failures;
            extra = result.extra;
        }

        const newLastProcessedId = batch.length > 0 ? (batch[batch.length - 1]._id as ObjectId) : lastProcessedId;

        const remainingCount =
            newLastProcessedId !== null
                ? await collection.countDocuments({ ...filter, _id: { $gt: newLastProcessedId } }, { readPreference })
                : 0;
        const progressPercentage =
            totalCount === 0
                ? 100
                : Math.min(100, Math.max(0, Math.round(((totalCount - remainingCount) / totalCount) * 100)));

        await this.stateRepo.saveProgress(jobName, newLastProcessedId, {
            batchSize,
            attemptedCount: batch.length,
            succeededCount: batch.length - failures.length,
            failedCount: failures.length,
            totalCount,
            remainingCount,
            progressPercentage,
            averageItemProcessingTimeMs,
        });

        this.logger.log(
            `Job "${jobName}" batch: attempted=${batch.length}, failed=${failures.length}, ` +
                `total=${totalCount}, remaining=${remainingCount}, progress=${progressPercentage}%, ` +
                `averageItemProcessingTime=${averageItemProcessingTimeMs ?? 'n/a'}ms`,
        );

        return {
            jobName,
            batchSize,
            attemptedCount: batch.length,
            succeededCount: batch.length - failures.length,
            failedCount: failures.length,
            failures,
            totalCount,
            remainingCount,
            progressPercentage,
            averageItemProcessingTimeMs,
            extra,
        };
    }
}
