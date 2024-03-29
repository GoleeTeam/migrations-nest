import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MigrationVersion, MigrationVersionDocument } from './migration-version.schema';

@Injectable()
export class MigrationVersionRepo {
    constructor(
        @InjectModel(MigrationVersion.name)
        private model: Model<MigrationVersionDocument>,
    ) {}

    public async getCurrentVersion(): Promise<number> {
        const saved_version = await this.model.findOne({});
        return saved_version?.version || 0;
    }

    public async setCurrentVersion(version: number): Promise<void> {
        await this.model.updateOne({}, { $set: { version } }, { upsert: true });
    }

    public async getMigrationLock() {
        const saved_version = await this.model.findOne({});
        return saved_version?.lock || false;
    }

    public async saveMigrationLock(lock: boolean): Promise<void> {
        await this.model.updateOne({}, { $set: { lock } }, { upsert: true });
    }

    async setLastRunCompleted(last_run_completed: boolean) {
        await this.model.updateOne({}, { $set: { last_run_completed } }, { upsert: true });
    }

    async setLastRunError(last_run_error: string) {
        await this.model.updateOne({}, { $set: { last_run_error } }, { upsert: true });
    }
}
