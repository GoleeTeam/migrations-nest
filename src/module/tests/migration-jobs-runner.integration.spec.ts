import { Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Collection, MongoClient, ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { InvalidBatchSizeError, JobAlreadyRunningError, JobNotFoundError } from '../errors/migration.errors';
import { MigrationJob, MigrationJobBatchResult, MigrationJobStatus } from '../interfaces/migration-job.interface';
import { MigrationJobsRunner } from '../migration-jobs-runner.service';
import { MigrationsRunner } from '../migration-runner.service';
import { MigrationsModule } from '../migrations.module';

const MONGO_TOKEN = 'TEST_MONGO_CLIENT';
const MIGRATIONS_COLLECTION = 'migrations_version';
const TEST_ITEMS_COLLECTION = 'test_items';

function makeJob(name: string, overrides: Partial<MigrationJob> = {}): MigrationJob {
    return {
        name,
        collectionName: TEST_ITEMS_COLLECTION,
        async processBatch(): Promise<MigrationJobBatchResult> {
            return { failures: [] };
        },
        ...overrides,
    };
}

describe('MigrationJobsRunner integration', () => {
    let mongoServer: MongoMemoryServer;
    let mongoClient: MongoClient;
    let migrationsCollection: Collection;
    let itemsCollection: Collection;
    let modules: TestingModule[] = [];

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        mongoClient = new MongoClient(mongoServer.getUri());
        await mongoClient.connect();
        migrationsCollection = mongoClient.db().collection(MIGRATIONS_COLLECTION);
        itemsCollection = mongoClient.db().collection(TEST_ITEMS_COLLECTION);
    });

    afterAll(async () => {
        await mongoClient.close();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        await itemsCollection.deleteMany({});
        await migrationsCollection.deleteMany({});
    });

    afterEach(async () => {
        await Promise.all(modules.map((module) => module.close()));
        modules = [];
    });

    async function insertTestDocs(count: number): Promise<ObjectId[]> {
        if (count === 0) return [];
        const result = await itemsCollection.insertMany(Array.from({ length: count }, (_, i) => ({ value: i })));
        return Object.values(result.insertedIds) as ObjectId[];
    }

    async function createTestingModule(
        jobs: MigrationJob[],
        scripts: { version: number; run: () => Promise<void> }[] = [],
        options: { maxBatchSize?: number } = {},
    ): Promise<TestingModule> {
        // Provide the MongoClient inside a NestJS module so MigrationsModule.forRoot
        // can inject it (providers declared in the outer TestingModule are not visible
        // to an imported module's factory inject list).
        class TestMongoModule {}
        Module({ providers: [{ provide: MONGO_TOKEN, useValue: mongoClient }], exports: [MONGO_TOKEN] })(
            TestMongoModule,
        );

        const module = await Test.createTestingModule({
            imports: [
                MigrationsModule.forRoot({
                    mongoClientToken: MONGO_TOKEN,
                    collectionName: MIGRATIONS_COLLECTION,
                    imports: [TestMongoModule],
                    scripts: scripts.map((s) => ({
                        provide: `Script_v${s.version}`,
                        useFactory: () => s,
                    })),
                    jobs: jobs.map((job) => ({
                        provide: `Job_${job.name}`,
                        useFactory: () => job,
                    })),
                    ...options,
                }),
            ],
        }).compile();
        await module.get(MigrationJobsRunner).onModuleInit();
        modules.push(module);
        return module;
    }

    describe('module initialization', () => {
        describe('Given migration and job documents coexist', () => {
            it('should not rerun a migration when a job state document is also in the collection', async () => {
                // Pre-seed: migration already at version 1 + a job state document from a previous run
                await migrationsCollection.insertMany([
                    { version: 1, lock: false, last_run_completed: true, last_run_error: '' },
                    { name: 'some-job', lock: false, lastProcessedId: null, lastBatchSize: null },
                ]);

                const runMock = jest.fn().mockResolvedValue(undefined);
                const module = await createTestingModule([], [{ version: 1, run: runMock }]);
                const migrationsRunner = module.get(MigrationsRunner);
                await migrationsRunner.runMigrations();

                expect(runMock).not.toHaveBeenCalled();
            });
        });

        describe('Given registered jobs', () => {
            it('should not call processBatch when the job runner is initialized', async () => {
                await insertTestDocs(5);
                const processBatch = jest.fn().mockResolvedValue({ failures: [] });
                await createTestingModule([makeJob('test-job', { processBatch })]);

                expect(processBatch).not.toHaveBeenCalled();
            });
        });
    });

    describe('runNextBatch', () => {
        describe('Given a new job', () => {
            it('should process the first batch and return correct counts', async () => {
                const ids = await insertTestDocs(5);
                const module = await createTestingModule([makeJob('test-job')]);
                const runner = module.get(MigrationJobsRunner);

                const result = await runner.runNextBatch('test-job', 3);

                expect(result).toMatchObject({
                    jobName: 'test-job',
                    batchSize: 3,
                    attemptedCount: 3,
                    succeededCount: 3,
                    failedCount: 0,
                    failures: [],
                    totalCount: 5,
                    remainingCount: 2,
                    progressPercentage: 60,
                });
                expect(result.itemsPerMinute).toEqual(expect.any(Number));

                // Checkpoint must be persisted
                const state = await migrationsCollection.findOne({ name: 'test-job' });
                expect(state).not.toBeNull();
                expect(state!.lastProcessedId.toString()).toBe(ids[2].toString());
                expect(state!.lastBatchSize).toBe(3);
            });
        });

        describe('Given an existing checkpoint', () => {
            it('should process only docs after the saved checkpoint', async () => {
                await insertTestDocs(5);
                const module = await createTestingModule([makeJob('test-job')]);
                const runner = module.get(MigrationJobsRunner);

                await runner.runNextBatch('test-job', 3); // processes first 3
                const result = await runner.runNextBatch('test-job', 10); // processes remaining 2

                expect(result.attemptedCount).toBe(2);
                expect(result.remainingCount).toBe(0);
                expect(result.progressPercentage).toBe(100);
            });
        });

        describe('Given an empty workload', () => {
            it('should not invoke processBatch and return all-zero counts', async () => {
                const processBatch = jest.fn().mockResolvedValue({ failures: [] });
                const module = await createTestingModule([makeJob('test-job', { processBatch })]);
                const runner = module.get(MigrationJobsRunner);

                const result = await runner.runNextBatch('test-job', 100);

                expect(processBatch).not.toHaveBeenCalled();
                expect(result).toMatchObject({
                    attemptedCount: 0,
                    succeededCount: 0,
                    failedCount: 0,
                    totalCount: 0,
                    remainingCount: 0,
                    progressPercentage: 100,
                    itemsPerMinute: null,
                });
            });
        });

        describe('Given partial failures', () => {
            it('should report failures and derive consistent counts', async () => {
                const ids = await insertTestDocs(3);

                const job = makeJob('test-job', {
                    async processBatch(docs): Promise<MigrationJobBatchResult> {
                        return {
                            failures: [{ itemId: docs[1]._id.toString(), error: 'processing error' }],
                        };
                    },
                });

                const module = await createTestingModule([job]);
                const runner = module.get(MigrationJobsRunner);
                const result = await runner.runNextBatch('test-job', 10);

                expect(result.attemptedCount).toBe(3);
                expect(result.succeededCount).toBe(2);
                expect(result.failedCount).toBe(1);
                expect(result.failures).toHaveLength(1);
                expect(result.failures[0]).toMatchObject({ itemId: ids[1].toString(), error: 'processing error' });
                expect(result.remainingCount).toBe(0);

                // Checkpoint must still be persisted (failure is a job-level decision, not a batch abort)
                const state = await migrationsCollection.findOne({ name: 'test-job' });
                expect(state!.lastProcessedId.toString()).toBe(ids[2].toString());
            });
        });

        describe('Given the batch callback throws', () => {
            it('should not advance checkpoint, should save error, and should release lock', async () => {
                const ids = await insertTestDocs(5);

                // First batch: succeed to establish a checkpoint
                const goodJob = makeJob('test-job');
                const firstModule = await createTestingModule([goodJob]);
                await firstModule.get(MigrationJobsRunner).runNextBatch('test-job', 2);

                const stateAfterFirst = await migrationsCollection.findOne({ name: 'test-job' });
                const checkpointAfterFirst = stateAfterFirst!.lastProcessedId.toString();
                expect(checkpointAfterFirst).toBe(ids[1].toString());

                // Second batch: throws
                const throwingJob = makeJob('test-job', {
                    processBatch(): Promise<MigrationJobBatchResult> {
                        throw new Error('explosion');
                    },
                });
                const secondModule = await createTestingModule([throwingJob]);
                const runner = secondModule.get(MigrationJobsRunner);

                await expect(runner.runNextBatch('test-job', 2)).rejects.toThrow('explosion');

                const stateAfterThrow = await migrationsCollection.findOne({ name: 'test-job' });

                // Checkpoint must not have advanced
                expect(stateAfterThrow!.lastProcessedId.toString()).toBe(checkpointAfterFirst);
                // Error recorded
                expect(stateAfterThrow!.lastRunError).toBe('explosion');
                // Lock released
                expect(stateAfterThrow!.lock).toBe(false);
            });
        });

        describe('Given concurrent requests', () => {
            it('should throw JobAlreadyRunningError when the same job lock is already held', async () => {
                await insertTestDocs(5);

                // Pre-acquire the lock directly to simulate a running job
                await migrationsCollection.insertOne({
                    name: 'test-job',
                    lock: true,
                    lastProcessedId: null,
                    lastBatchSize: null,
                    lastRunError: '',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });

                const module = await createTestingModule([makeJob('test-job')]);
                const runner = module.get(MigrationJobsRunner);

                await expect(runner.runNextBatch('test-job', 5)).rejects.toThrow(JobAlreadyRunningError);
            });

            it('should allow concurrent runs of different jobs', async () => {
                await insertTestDocs(10);

                const jobA = makeJob('job-a');
                const jobB = makeJob('job-b');

                const module = await createTestingModule([jobA, jobB]);
                const runner = module.get(MigrationJobsRunner);

                const [resultA, resultB] = await Promise.all([
                    runner.runNextBatch('job-a', 5),
                    runner.runNextBatch('job-b', 5),
                ]);

                expect(resultA.attemptedCount).toBe(5);
                expect(resultB.attemptedCount).toBe(5);
            });
        });

        describe('Given invalid input', () => {
            it('should throw JobNotFoundError for an unknown job name', async () => {
                const module = await createTestingModule([]);
                const runner = module.get(MigrationJobsRunner);

                await expect(runner.runNextBatch('nonexistent', 10)).rejects.toThrow(JobNotFoundError);

                // No state document should have been created
                const docs = await migrationsCollection.find({ name: { $exists: true } }).toArray();
                expect(docs).toHaveLength(0);
            });

            it('should throw InvalidBatchSizeError for zero', async () => {
                const module = await createTestingModule([makeJob('test-job')]);
                const runner = module.get(MigrationJobsRunner);
                await expect(runner.runNextBatch('test-job', 0)).rejects.toThrow(InvalidBatchSizeError);
            });

            it('should throw InvalidBatchSizeError for a non-integer', async () => {
                const module = await createTestingModule([makeJob('test-job')]);
                const runner = module.get(MigrationJobsRunner);
                await expect(runner.runNextBatch('test-job', 1.5)).rejects.toThrow(InvalidBatchSizeError);
            });

            it('should throw InvalidBatchSizeError when batchSize exceeds the configured maximum', async () => {
                const module = await createTestingModule([makeJob('test-job')], [], { maxBatchSize: 2 });
                const runner = module.get(MigrationJobsRunner);
                await expect(runner.runNextBatch('test-job', 3)).rejects.toThrow(InvalidBatchSizeError);
            });
        });
    });

    describe('getJobStatus', () => {
        describe('Given a registered job that has never run', () => {
            it('should return a not-started status without creating a document', async () => {
                const module = await createTestingModule([makeJob('test-job')]);
                const runner = module.get(MigrationJobsRunner);

                const status = await runner.getJobStatus('test-job');

                expect(status).toMatchObject<MigrationJobStatus>({
                    jobName: 'test-job',
                    lock: false,
                    lastRunError: '',
                    progressPercentage: 0,
                    attemptedCount: null,
                    succeededCount: null,
                    failedCount: null,
                    totalCount: null,
                    remainingCount: null,
                    itemsPerMinute: null,
                    estimatedRemainingProcessingTime: null,
                });
                const docs = await migrationsCollection.find({ name: 'test-job' }).toArray();
                expect(docs).toHaveLength(0);
            });
        });

        describe('Given a job after a successful batch', () => {
            it('should return the persisted run snapshot', async () => {
                await insertTestDocs(5);
                const module = await createTestingModule([makeJob('test-job')]);
                const runner = module.get(MigrationJobsRunner);

                const runResult = await runner.runNextBatch('test-job', 3);
                const status = await runner.getJobStatus('test-job');

                expect(status).toMatchObject<MigrationJobStatus>({
                    jobName: 'test-job',
                    lock: false,
                    lastRunError: '',
                    attemptedCount: runResult.attemptedCount,
                    succeededCount: runResult.succeededCount,
                    failedCount: runResult.failedCount,
                    totalCount: runResult.totalCount,
                    remainingCount: runResult.remainingCount,
                    progressPercentage: runResult.progressPercentage,
                    itemsPerMinute: runResult.itemsPerMinute,
                    estimatedRemainingProcessingTime: expect.any(String),
                });
            });
        });
    });
});
