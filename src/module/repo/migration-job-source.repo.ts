import { Document, Filter, MongoClient, ObjectId, WithId } from 'mongodb';
import { MigrationJob } from '../interfaces/migration-job.interface';

type MigrationJobBatch = {
    documents: WithId<Document>[];
    totalCount: number;
};

export class MigrationJobSourceRepo {
    constructor(private readonly mongoClient: MongoClient) {}

    async findBatch(job: MigrationJob, afterId: ObjectId | null, batchSize: number): Promise<MigrationJobBatch> {
        const collection = this.mongoClient.db().collection(job.collectionName);
        const filter = job.filter ?? {};
        const readPreference = job.readPreference ?? 'secondaryPreferred';
        const batchFilter = this.withCheckpoint(filter, afterId);

        const [totalCount, documents] = await Promise.all([
            collection.countDocuments(filter, { readPreference }),
            collection.find(batchFilter, { readPreference }).sort({ _id: 1 }).limit(batchSize).toArray(),
        ]);

        return { documents, totalCount };
    }

    countRemaining(job: MigrationJob, afterId: ObjectId | null): Promise<number> {
        if (afterId === null) return Promise.resolve(0);

        return this.mongoClient
            .db()
            .collection(job.collectionName)
            .countDocuments(this.withCheckpoint(job.filter ?? {}, afterId), {
                readPreference: job.readPreference ?? 'secondaryPreferred',
            });
    }

    private withCheckpoint(filter: Filter<Document>, afterId: ObjectId | null): Filter<Document> {
        return afterId ? { ...filter, _id: { $gt: afterId } } : filter;
    }
}
