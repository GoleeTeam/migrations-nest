import { Injectable } from '@nestjs/common';
import { Collection, MongoClient } from 'mongodb';

export class MigrationVersion {
    version: number;
    lock: boolean;
    last_run_completed: boolean;
    last_run_error: string;
}

// Selector that targets only the migration version document, never job state documents.
// Job state documents have a `name` field but no `version` field.
const MIGRATION_DOC_FILTER = { version: { $exists: true } };

@Injectable()
export class MigrationVersionRepo {
    private collection: Collection<MigrationVersion>;

    constructor(mongoClient: MongoClient, collectionName: string) {
        this.collection = mongoClient.db().collection<MigrationVersion>(collectionName);
    }

    public async init() {
        const versionExists = await this.collection.findOne(MIGRATION_DOC_FILTER);
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
        const saved_version = await this.collection.findOne(MIGRATION_DOC_FILTER);
        return saved_version?.version || 0;
    }

    public async setCurrentVersion(version: number): Promise<void> {
        await this.collection.updateOne(MIGRATION_DOC_FILTER, { $set: { version } });
    }

    public async getMigrationLock() {
        const saved_version = await this.collection.findOne(MIGRATION_DOC_FILTER);
        return saved_version?.lock || false;
    }

    public async saveMigrationLock(lock: boolean): Promise<void> {
        await this.collection.updateOne(MIGRATION_DOC_FILTER, { $set: { lock } });
    }

    async setLastRunCompleted(last_run_completed: boolean) {
        await this.collection.updateOne(MIGRATION_DOC_FILTER, { $set: { last_run_completed } });
    }

    async setLastRunError(last_run_error: string) {
        await this.collection.updateOne(MIGRATION_DOC_FILTER, { $set: { last_run_error } });
    }
}
