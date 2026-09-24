import { Document, Filter, ReadPreferenceLike, WithId } from 'mongodb';

export interface MigrationJob {
    name: string;
    collectionName: string;
    filter?: Filter<Document>;
    readPreference?: ReadPreferenceLike;
    processBatch(docs: WithId<Document>[]): Promise<MigrationJobBatchResult>;
}

export interface MigrationJobBatchResult {
    failures: MigrationJobItemFailure[];
    extra?: unknown;
}

export interface MigrationJobItemFailure {
    itemId: string;
    error: string;
}

export interface MigrationJobRunResult {
    jobName: string;
    batchSize: number;
    attemptedCount: number;
    succeededCount: number;
    failedCount: number;
    failures: MigrationJobItemFailure[];
    totalCount: number;
    remainingCount: number;
    progressPercentage: number;
    itemsPerMinute: number | null;
    extra?: unknown;
}

export interface MigrationJobStatus {
    jobName: string;
    lock: boolean;
    lastRunError: string;
    attemptedCount: number | null;
    succeededCount: number | null;
    failedCount: number | null;
    totalCount: number | null;
    remainingCount: number | null;
    progressPercentage: number;
    itemsPerMinute: number | null;
    estimatedRemainingProcessingTime: string | null;
}
