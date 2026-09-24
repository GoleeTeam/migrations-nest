import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { InvalidBatchSizeError, JobAlreadyRunningError, JobNotFoundError } from './errors/migration.errors';
import {
    MigrationJob,
    MigrationJobItemFailure,
    MigrationJobRunResult,
    MigrationJobStatus,
} from './interfaces/migration-job.interface';
import { MigrationJobSourceRepo } from './repo/migration-job-source.repo';
import { MigrationJobStateRepo } from './repo/migration-job-state.repo';

const DEFAULT_MAX_BATCH_SIZE = 10_000;

@Injectable()
export class MigrationJobsRunner implements OnModuleInit {
    private readonly logger = new Logger(MigrationJobsRunner.name);

    constructor(
        private readonly jobs: MigrationJob[],
        private readonly stateRepo: MigrationJobStateRepo,
        private readonly sourceRepo: MigrationJobSourceRepo,
        private readonly maxBatchSize: number = DEFAULT_MAX_BATCH_SIZE,
    ) {}

    async onModuleInit(): Promise<void> {
        await this.stateRepo.init();
    }

    async runNextBatch(jobName: string, batchSize: number): Promise<MigrationJobRunResult> {
        this.validateBatchSize(batchSize);

        const job = this.jobs.find((candidate) => candidate.name === jobName);
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
        const job = this.jobs.find((candidate) => candidate.name === jobName);
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
                itemsPerMinute: null,
                estimatedRemainingProcessingTime: null,
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
            itemsPerMinute: doc.itemsPerMinute ?? null,
            estimatedRemainingProcessingTime: doc.estimatedRemainingProcessingTime ?? null,
        };
    }

    private async executeBatch(job: MigrationJob, jobName: string, batchSize: number): Promise<MigrationJobRunResult> {
        const lastProcessedId = await this.stateRepo.getLastProcessedId(jobName);
        const { documents: batch, totalCount } = await this.sourceRepo.findBatch(job, lastProcessedId, batchSize);

        let failures: MigrationJobItemFailure[] = [];
        let extra: unknown;
        let processingTimeMs: number | null = null;
        let itemsPerMinute: number | null = null;

        if (batch.length > 0) {
            const processingStartedAt = process.hrtime.bigint();
            const result = await job.processBatch(batch);
            processingTimeMs = Number(process.hrtime.bigint() - processingStartedAt) / 1_000_000;
            itemsPerMinute = processingTimeMs > 0 ? Math.round((batch.length / processingTimeMs) * 60_000) : null;
            failures = result.failures;
            extra = result.extra;
        }

        const newLastProcessedId = batch.length > 0 ? (batch[batch.length - 1]._id as ObjectId) : lastProcessedId;

        const remainingCount = await this.sourceRepo.countRemaining(job, newLastProcessedId);
        const progressPercentage =
            totalCount === 0
                ? 100
                : Math.min(100, Math.max(0, Math.round(((totalCount - remainingCount) / totalCount) * 100)));
        const estimatedRemainingProcessingTime =
            remainingCount === 0
                ? '0m'
                : processingTimeMs !== null
                  ? formatDuration((remainingCount / batch.length) * processingTimeMs)
                  : null;

        await this.stateRepo.saveProgress(jobName, newLastProcessedId, {
            batchSize,
            attemptedCount: batch.length,
            succeededCount: batch.length - failures.length,
            failedCount: failures.length,
            totalCount,
            remainingCount,
            progressPercentage,
            itemsPerMinute,
            estimatedRemainingProcessingTime,
        });

        this.logger.log(
            `Job "${jobName}" batch: attempted=${batch.length}, failed=${failures.length}, ` +
                `total=${totalCount}, remaining=${remainingCount}, progress=${progressPercentage}%, ` +
                `itemsPerMinute=${itemsPerMinute ?? 'n/a'}, ` +
                `estimatedRemainingProcessingTime=${estimatedRemainingProcessingTime ?? 'n/a'}`,
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
            itemsPerMinute,
            extra,
        };
    }
}

function formatDuration(durationMs: number): string {
    if (durationMs < 60_000) return '<1m';

    const totalMinutes = Math.ceil(durationMs / 60_000);
    const days = Math.floor(totalMinutes / 1_440);
    const hours = Math.floor((totalMinutes % 1_440) / 60);
    const minutes = totalMinutes % 60;

    return [days > 0 ? `${days}d` : null, hours > 0 ? `${hours}h` : null, minutes > 0 ? `${minutes}m` : null]
        .filter(Boolean)
        .join(' ');
}
