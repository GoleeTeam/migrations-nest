import { Collection, MongoClient, ObjectId } from 'mongodb';

type JobStateDocument = {
    name: string;
    lock: boolean;
    lastProcessedId: ObjectId | null;
    lastBatchSize: number | null;
    lastRunError: string;
    createdAt: Date;
    updatedAt: Date;
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

    async saveProgress(jobName: string, lastProcessedId: ObjectId | null, lastBatchSize: number): Promise<void> {
        await this.collection.updateOne(
            { name: jobName },
            {
                $set: {
                    lastProcessedId,
                    lastBatchSize,
                    lastRunError: '',
                    updatedAt: new Date(),
                },
            },
        );
    }

    async saveError(jobName: string, error: string): Promise<void> {
        await this.collection.updateOne({ name: jobName }, { $set: { lastRunError: error, updatedAt: new Date() } });
    }
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}
