import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MigrationVersion, MigrationVersionDocument } from './migration-version.schema';

@Injectable()
export class MigrationVersionRepo {
	constructor(
		@InjectModel(MigrationVersion.name)
		private migrationVersionRepo: Model<MigrationVersionDocument>
	) {}

	public async getCurrentVersion(): Promise<number> {
		const saved_version = await this.migrationVersionRepo.findOne({});
		return saved_version?.version || 0;
	}

	public async setCurrentVersion(version: number): Promise<void> {
		await this.migrationVersionRepo.updateOne({}, { $set: { version } }, { upsert: true });
	}

	public async getMigrationLock() {
		const saved_version = await this.migrationVersionRepo.findOne({});
		return saved_version?.lock || false;
	}

	public async saveMigrationLock(lock: boolean): Promise<void> {
		await this.migrationVersionRepo.updateOne({}, { $set: { lock } }, { upsert: true });
	}
}
