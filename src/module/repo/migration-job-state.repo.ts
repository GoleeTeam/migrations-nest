import { Collection, MongoClient, ObjectId } from 'mongodb';

type JobStateDocument = {
    name: string;
    lock: boolean;
    lastProcessedId: ObjectId | null;
    lastBatchSize: number | null;
    lastRunError: string;
    // Last-run snapshot (null = never run)
    attemptedCount: number | null;
    succeededCount: number | null;
    failedCount: number | null;
    totalCount: number | null;
    remainingCount: number | null;
    progressPercentage: number | null;
    averageItemProcessingTimeMs: number | null;
    createdAt: Date;
    updatedAt: Date;
};

type RunSnapshot = {
    batchSize: number;
    attemptedCount: number;
    succeededCount: number;
    failedCount: number;
    totalCount: number;
    remainingCount: number;
    progressPercentage: number;
    averageItemProcessingTimeMs: number | null;
};

export class MigrationJobStateRepo {
    private readonly collection: Collection<JobStateDocument>;

    constructor(mongoClient: MongoClient, collectionName: string) {
        this.collection = mongoClient.db().collection<JobStateDocument>(collectionName);
    }

    async init(): Promise<void> {
        await this.collection.createIndex({ name: 1 }, { unique: true, sparse: true });
    }

    async tryAcquireLock(jobName: string): Promise<boolean> {
        try {
            const result = await this.collection.updateOne(
                { name: jobName, lock: { $ne: true } },
                {
                    $set: { lock: true, updatedAt: new Date() },
                    $setOnInsert: {
                        lastProcessedId: null,
                        lastBatchSize: null,
                        lastRunError: '',
                        attemptedCount: null,
                        succeededCount: null,
                        failedCount: null,
                        totalCount: null,
                        remainingCount: null,
                        progressPercentage: null,
                        averageItemProcessingTimeMs: null,
                        createdAt: new Date(),
                    },
                },
                { upsert: true },
            );
            return result.modifiedCount === 1 || result.upsertedCount === 1;
        } catch (error: unknown) {
            if (isDuplicateKeyError(error)) return false;
            throw error;
        }
    }

    async releaseLock(jobName: string): Promise<void> {
        await this.collection.updateOne({ name: jobName }, { $set: { lock: false, updatedAt: new Date() } });
    }

    async getLastProcessedId(jobName: string): Promise<ObjectId | null> {
        const doc = await this.collection.findOne({ name: jobName });
        return doc?.lastProcessedId ?? null;
    }

    async saveProgress(jobName: string, lastProcessedId: ObjectId | null, snapshot: RunSnapshot): Promise<void> {
        await this.collection.updateOne(
            { name: jobName },
            {
                $set: {
                    lastProcessedId,
                    lastBatchSize: snapshot.batchSize,
                    lastRunError: '',
                    attemptedCount: snapshot.attemptedCount,
                    succeededCount: snapshot.succeededCount,
                    failedCount: snapshot.failedCount,
                    totalCount: snapshot.totalCount,
                    remainingCount: snapshot.remainingCount,
                    progressPercentage: snapshot.progressPercentage,
                    averageItemProcessingTimeMs: snapshot.averageItemProcessingTimeMs,
                    updatedAt: new Date(),
                },
            },
        );
    }

    async saveError(jobName: string, error: string): Promise<void> {
        await this.collection.updateOne({ name: jobName }, { $set: { lastRunError: error, updatedAt: new Date() } });
    }

    async getStatus(jobName: string): Promise<JobStateDocument | null> {
        return this.collection.findOne({ name: jobName });
    }
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}
