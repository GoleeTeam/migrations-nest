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

    constructor(mongoClient: MongoClient, collectionName = 'migrations_version') {
        this.collection = mongoClient.db().collection<MigrationVersion>(collectionName);
    }

    public async init() {
        const versionExists = await this.collection.findOne({});
        if (!versionExists) {
            await this.collection.insertOne({
                version: 0,
                lock: false,
                last_run_completed: false,
                last_run_error: '',
            });
        }
    }

    public async getCurrentVersion(): Promise<number> {
        const saved_version = await this.collection.findOne({});
        return saved_version?.version || 0;
    }

    public async setCurrentVersion(version: number): Promise<void> {
        await this.collection.updateOne({}, { $set: { version } }, { upsert: true });
    }

    public async getMigrationLock() {
        const saved_version = await this.collection.findOne({});
        return saved_version?.lock || false;
    }

    public async saveMigrationLock(lock: boolean): Promise<void> {
        await this.collection.updateOne({}, { $set: { lock } }, { upsert: true });
    }

    async setLastRunCompleted(last_run_completed: boolean) {
        await this.collection.updateOne({}, { $set: { last_run_completed } }, { upsert: true });
    }

    async setLastRunError(last_run_error: string) {
        await this.collection.updateOne({}, { $set: { last_run_error } }, { upsert: true });
    }
}
