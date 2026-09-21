import { Injectable } from '@nestjs/common';
import { Collection, MongoClient } from 'mongodb';

export class MigrationVersion {
    version: number;
    lock: boolean;
    last_run_completed: boolean;
    last_run_error: string;
}

@Injectable()
export class MigrationVersionRepo {
    private collection: Collection<MigrationVersion>;

    constructor(mongoClient: MongoClient, collectionName: string) {
        this.collection = mongoClient.db().collection<MigrationVersion>(collectionName);
    }

    public async init() {
        await this.collection.updateOne(
            {},
            { $setOnInsert: { version: 0, lock: false, last_run_completed: false, last_run_error: '' } },
            { upsert: true },
        );
    }

    public async getCurrentVersion(): Promise<number> {
        const saved_version = await this.collection.findOne({});
        return saved_version?.version || 0;
    }

    public async setCurrentVersion(version: number): Promise<void> {
        await this.collection.updateOne({}, { $set: { version } });
    }

    public async tryAcquireLock(): Promise<boolean> {
        const result = await this.collection.updateOne({ lock: { $ne: true } }, { $set: { lock: true } });
        return result.modifiedCount === 1;
    }

    public async releaseLock(): Promise<void> {
        await this.collection.updateOne({}, { $set: { lock: false } });
    }

    async setLastRunCompleted(last_run_completed: boolean) {
        await this.collection.updateOne({}, { $set: { last_run_completed } });
    }

    async setLastRunError(last_run_error: string) {
        await this.collection.updateOne({}, { $set: { last_run_error } });
    }
}
