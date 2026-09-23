import { Document, Filter, ReadPreferenceLike, WithId } from 'mongodb';

export interface MigrationJob {
    name: string;
    collectionName: string;
    filter?: Filter<Document>;
    readPreference?: ReadPreferenceLike;
    processBatch(docs: WithId<Document>[], requestedCount: number): Promise<MigrationJobBatchResult>;
}

export interface MigrationJobBatchResult {
    failures: JobFailure[];
    extra?: unknown;
}

export interface JobFailure {
    itemId: string;
    error: string;
}

export interface MigrationJobChunkResult {
    jobName: string;
    requestedCount: number;
    attemptedCount: number;
    succeededCount: number;
    failedCount: number;
    failures: JobFailure[];
    totalItemsCount: number;
    remainingItemsCount: number;
    extra?: unknown;
}
